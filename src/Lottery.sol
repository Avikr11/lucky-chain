// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

contract Lottery is VRFConsumerBaseV2Plus {
    address public manager;
    address[] public players;

    uint256 public constant ENTRY_FEE = 0.01 ether;
    uint256 public constant ROUND_DURATION = 1 hours;
    uint256 public constant VRF_TIMEOUT = 24 hours;

    uint16 public constant REQUEST_CONFIRMATIONS = 3;
    uint32 public constant CALLBACK_GAS_LIMIT = 100_000;
    uint32 public constant NUM_WORDS = 1;

    uint256 public immutable subscriptionId;
    bytes32 public immutable keyHash;

    uint256 public roundEndTime;
    uint256 public lastRequestId;

    uint256 public randomnessRequestTime;
    mapping(address => uint256) public refundCredits;
    uint256 public totalRefundLiability;

    uint256 public randomWord;
    bool public randomnessFulfilled;
    address public winner;
    mapping(address => uint256) public pendingWinnings;

    enum LotteryState {
        OPEN,
        CALCULATING,
        PAYOUT,
        REFUND
    }

    struct Round {
        address[] players;
        uint256 endTime;
        uint256 entryFees;
        uint256 requestId;
        uint256 requestTime;
        uint256 randomWord;
        uint256 prizeAmount;
        address winner;
        LotteryState state;
        bool randomnessFulfilled;
    }

    uint256 public currentRoundId;
    mapping(uint256 => Round) private rounds;
    mapping(uint256 => uint256) public requestIdToRoundId;
    mapping(uint256 => mapping(address => uint256)) public roundRefundCredits;

    uint256 public totalPrizeLiability;

    LotteryState public state;

    event RandomnessRequested(uint256 indexed requestId);
    event RandomnessReceived(uint256 indexed requestId, uint256 randomWord);
    event WinnerSelected(address indexed winner, uint256 prizePool);
    event WinningsWithdrawn(address indexed winner, uint256 amount);
    event WinningsRedirected(address indexed winner, address indexed recipient, uint256 amount);
    event LotteryAborted(uint256 indexed requestId);
    event RefundWithdrawn(address indexed player, uint256 amount);
    event SurplusRecovered(address indexed manager, uint256 amount);

    constructor(address vrfCoordinator, uint256 _subscriptionId, bytes32 _keyHash)
        VRFConsumerBaseV2Plus(vrfCoordinator)
    {
        manager = msg.sender;
        subscriptionId = _subscriptionId;
        keyHash = _keyHash;

        currentRoundId = 1;

        Round storage firstRound = rounds[currentRoundId];
        firstRound.endTime = block.timestamp + ROUND_DURATION;
        firstRound.state = LotteryState.OPEN;

        // Preserve compatibility with the existing single-round interface.
        roundEndTime = firstRound.endTime;
        state = LotteryState.OPEN;
    }

    function enterLottery() external payable {
        Round storage currentRound = rounds[currentRoundId];
        require(currentRound.state == LotteryState.OPEN, "Lottery is not open");
        require(block.timestamp < currentRound.endTime, "Round has ended");
        require(msg.value >= ENTRY_FEE, "Insufficient entry fee");

        currentRound.players.push(msg.sender);
        currentRound.entryFees += msg.value;

        // Track each player's contribution against this specific round.
        roundRefundCredits[currentRoundId][msg.sender] += msg.value;

        // Preserve aggregate accounting and the legacy public getters.
        players.push(msg.sender);
        refundCredits[msg.sender] += msg.value;
        totalRefundLiability += msg.value;
    }

    function closeLottery() external {
        Round storage currentRound = rounds[currentRoundId];

        require(currentRound.state == LotteryState.OPEN, "Lottery is not open");
        require(block.timestamp >= currentRound.endTime, "Round has not ended");
        require(currentRound.players.length > 0, "No players");

        currentRound.state = LotteryState.CALCULATING;
        state = LotteryState.CALCULATING;

        uint256 requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: CALLBACK_GAS_LIMIT,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: false}))
            })
        );

        currentRound.requestId = requestId;
        currentRound.requestTime = block.timestamp;
        requestIdToRoundId[requestId] = currentRoundId;

        // Temporary compatibility with existing functions and tests.
        lastRequestId = requestId;
        randomnessRequestTime = block.timestamp;

        emit RandomnessRequested(requestId);
    }

    function advanceEmptyRound() external {
        Round storage currentRound = rounds[currentRoundId];

        require(currentRound.state == LotteryState.OPEN, "Lottery is not open");
        require(block.timestamp >= currentRound.endTime, "Round has not ended");
        require(currentRound.players.length == 0, "Round has players");

        currentRoundId++;

        Round storage nextRound = rounds[currentRoundId];
        nextRound.endTime = block.timestamp + ROUND_DURATION;
        nextRound.state = LotteryState.OPEN;

        // Preserve compatibility with the existing public interface.
        roundEndTime = nextRound.endTime;
        state = LotteryState.OPEN;
    }

    function startNextRound() external {
        Round storage currentRound = rounds[currentRoundId];

        require(
            currentRound.state == LotteryState.PAYOUT || currentRound.state == LotteryState.REFUND, "Round not finished"
        );

        currentRoundId++;

        Round storage nextRound = rounds[currentRoundId];
        nextRound.endTime = block.timestamp + ROUND_DURATION;
        nextRound.state = LotteryState.OPEN;

        // Preserve compatibility with the existing public interface.
        roundEndTime = nextRound.endTime;
        state = LotteryState.OPEN;
    }

    function getPlayers() external view returns (address[] memory) {
        return players;
    }

    function getPlayersCount() external view returns (uint256) {
        return players.length;
    }

    function withdrawWinnings() external {
        uint256 amount = pendingWinnings[msg.sender];
        require(amount > 0, "No winnings to withdraw");

        // Effects first: prevent re-entrancy and update liabilities.
        pendingWinnings[msg.sender] = 0;
        totalPrizeLiability -= amount;

        // Interaction second: send ETH to the winner.
        (bool success,) = payable(msg.sender).call{value: amount}("");
        require(success, "Withdrawal failed");

        emit WinningsWithdrawn(msg.sender, amount);
    }

    /// @notice Allows the winner to send their prize to another address.
    /// @dev Only the winner can authorize withdrawal of their own winnings.
    function withdrawWinningsTo(address payable recipient) external {
        uint256 amount = pendingWinnings[msg.sender];

        require(amount > 0, "No winnings to withdraw");
        require(recipient != address(0), "Invalid recipient");

        // Effects first: clear winnings and update liabilities.
        pendingWinnings[msg.sender] = 0;
        totalPrizeLiability -= amount;

        // Interaction second: transfer the prize to the chosen recipient.
        (bool success,) = recipient.call{value: amount}("");
        require(success, "Withdrawal failed");

        emit WinningsRedirected(msg.sender, recipient, amount);
    }

    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        uint256 roundId = requestIdToRoundId[requestId];
        require(roundId != 0, "Unknown request ID");
        Round storage requestedRound = rounds[roundId];

        require(requestedRound.state == LotteryState.CALCULATING, "Lottery not calculating");
        require(requestId == requestedRound.requestId, "Unknown request ID");
        require(!requestedRound.randomnessFulfilled, "Randomness already fulfilled");
        require(randomWords.length > 0, "No random words");

        uint256 word = randomWords[0];
        requestedRound.randomWord = word;
        requestedRound.randomnessFulfilled = true;

        uint256 winnerIndex = word % requestedRound.players.length;
        address roundWinner = requestedRound.players[winnerIndex];
        requestedRound.winner = roundWinner;

        // Allocate only this round's recorded entry fees.
        uint256 prizePool = requestedRound.entryFees;
        requestedRound.prizeAmount = prizePool;

        // This round's contributions are no longer refundable after a successful draw.
        totalRefundLiability -= prizePool;

        pendingWinnings[roundWinner] += prizePool;
        totalPrizeLiability += prizePool;

        requestedRound.state = LotteryState.PAYOUT;

        // Temporary compatibility with the existing single-round interface.
        randomWord = word;
        randomnessFulfilled = true;
        winner = roundWinner;
        state = LotteryState.PAYOUT;

        emit RandomnessReceived(requestId, word);
        emit WinnerSelected(roundWinner, prizePool);
    }

    function abortLottery() external {
        Round storage currentRound = rounds[currentRoundId];

        require(currentRound.state == LotteryState.CALCULATING, "Lottery not calculating");
        require(block.timestamp >= currentRound.requestTime + VRF_TIMEOUT, "VRF timeout not reached");

        currentRound.state = LotteryState.REFUND;

        // Temporary compatibility with the existing single-round interface.
        state = LotteryState.REFUND;

        emit LotteryAborted(currentRound.requestId);
    }

    function abortRound(uint256 roundId) external {
        require(roundId != 0, "Invalid round ID");

        Round storage requestedRound = rounds[roundId];

        require(requestedRound.state == LotteryState.CALCULATING, "Round not calculating");
        require(block.timestamp >= requestedRound.requestTime + VRF_TIMEOUT, "VRF timeout not reached");

        requestedRound.state = LotteryState.REFUND;

        // Update legacy state only when aborting the current round.
        if (roundId == currentRoundId) {
            state = LotteryState.REFUND;
        }

        emit LotteryAborted(requestedRound.requestId);
    }

    function withdrawRefund() external {
        _withdrawRefundForRound(currentRoundId, msg.sender);
    }

    function withdrawRefundForRound(uint256 roundId) external {
        _withdrawRefundForRound(roundId, msg.sender);
    }

    function _withdrawRefundForRound(uint256 roundId, address player) internal {
        require(roundId != 0, "Invalid round ID");

        Round storage requestedRound = rounds[roundId];
        require(requestedRound.state == LotteryState.REFUND, "Refunds not available");

        uint256 amount = roundRefundCredits[roundId][player];
        require(amount > 0, "No refund available");

        uint256 legacyCredit = refundCredits[player];
        require(legacyCredit >= amount, "Refund accounting mismatch");

        // Update accounting before transferring ETH.
        roundRefundCredits[roundId][player] = 0;
        refundCredits[player] = legacyCredit - amount;
        totalRefundLiability -= amount;

        (bool success,) = payable(player).call{value: amount}("");
        require(success, "Refund transfer failed");

        emit RefundWithdrawn(player, amount);
    }

    function recoverSurplus() external {
        require(msg.sender == manager, "Only manager");

        uint256 balance = address(this).balance;
        uint256 protectedLiabilities = totalRefundLiability + totalPrizeLiability;

        require(balance > protectedLiabilities, "No surplus to recover");

        uint256 amount = balance - protectedLiabilities;

        (bool success,) = payable(manager).call{value: amount}("");
        require(success, "Surplus recovery failed");

        emit SurplusRecovered(manager, amount);
    }
}
