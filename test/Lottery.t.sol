// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Lottery} from "../src/Lottery.sol";
import {MockVRFCoordinatorV2Plus} from "./mocks/MockVRFCoordinatorV2Plus.sol";

contract RejectEther {
    function enter(Lottery lottery, uint256 fee) external {
        lottery.enterLottery{value: fee}();
    }

    function withdraw(Lottery lottery) external {
        lottery.withdrawWinnings();
    }

    function withdrawWinningsTo(Lottery lottery, address payable recipient) external {
        lottery.withdrawWinningsTo(recipient);
    }

    receive() external payable {
        revert("RejectEther: cannot receive ETH");
    }

    function withdrawRefund(Lottery lottery) external {
        lottery.withdrawRefund();
    }
}

contract ForceEther {
    constructor() payable {}

    function forceSend(address payable target) external {
        selfdestruct(target);
    }
}

contract ReentrantWinner {
    Lottery public lottery;
    uint256 public receiveCount;
    bool public reentryBlocked;

    constructor(Lottery _lottery) {
        lottery = _lottery;
    }

    function enter(uint256 fee) external {
        lottery.enterLottery{value: fee}();
    }

    function withdraw() external {
        lottery.withdrawWinnings();
    }

    receive() external payable {
        receiveCount++;

        (bool success,) = address(lottery).call(abi.encodeWithSelector(Lottery.withdrawWinnings.selector));

        reentryBlocked = !success;
    }
}

contract ReentrantRefundRecipient {
    Lottery public lottery;
    uint256 public receiveCount;
    bool public reentryBlocked;

    constructor(Lottery _lottery) {
        lottery = _lottery;
    }

    function enter(uint256 fee) external {
        lottery.enterLottery{value: fee}();
    }

    function withdrawRefund() external {
        lottery.withdrawRefund();
    }

    receive() external payable {
        receiveCount++;

        (bool success,) = address(lottery).call(abi.encodeWithSelector(Lottery.withdrawRefund.selector));

        reentryBlocked = !success;
    }
}

contract LotteryTest is Test {
    Lottery lottery;
    MockVRFCoordinatorV2Plus coordinator;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    receive() external payable {}

    function setUp() public {
        coordinator = new MockVRFCoordinatorV2Plus();
        lottery = new Lottery(address(coordinator), 123, bytes32(uint256(456)));

        vm.deal(alice, 1 ether);
        vm.deal(bob, 1 ether);
    }

    function test_EntryWithExactFee() public {
        uint256 fee = lottery.ENTRY_FEE();
        vm.prank(alice);
        lottery.enterLottery{value: fee}();
        assertEq(lottery.getPlayersCount(), 1);
        assertEq(lottery.players(0), alice);
    }

    function test_RevertWhen_EntryFeeIsInsufficient() public {
        vm.expectRevert(bytes("Insufficient entry fee"));
        vm.prank(alice);
        lottery.enterLottery{value: 0.005 ether}();
    }

    function test_TwoPlayersCanEnter() public {
        uint256 fee = lottery.ENTRY_FEE();
        vm.prank(alice);
        lottery.enterLottery{value: fee}();
        vm.prank(bob);
        lottery.enterLottery{value: fee}();
        assertEq(lottery.getPlayersCount(), 2);
        assertEq(lottery.players(0), alice);
        assertEq(lottery.players(1), bob);
    }

    function test_EntryIncreasesPlayerCount() public {
        assertEq(lottery.getPlayersCount(), 0);
        uint256 fee = lottery.ENTRY_FEE();
        vm.prank(alice);
        lottery.enterLottery{value: fee}();
        assertEq(lottery.getPlayersCount(), 1);
    }

    function test_RevertWhen_EnteringAfterDeadline() public {
        vm.warp(lottery.roundEndTime());
        uint256 fee = lottery.ENTRY_FEE();
        vm.expectRevert(bytes("Round has ended"));
        vm.prank(alice);
        lottery.enterLottery{value: fee}();
    }

    function test_InitialStateIsOpen() public view {
        assertEq(uint256(lottery.state()), uint256(Lottery.LotteryState.OPEN));
    }

    function test_RevertWhen_ClosingBeforeDeadline() public {
        vm.expectRevert(bytes("Round has not ended"));
        lottery.closeLottery();
    }

    function test_RevertWhen_EnteringDuringCalculation() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        assertEq(uint256(lottery.state()), uint256(Lottery.LotteryState.CALCULATING));

        vm.expectRevert(bytes("Lottery is not open"));
        vm.prank(bob);
        lottery.enterLottery{value: fee}();

        assertEq(lottery.getPlayersCount(), 1);
        assertEq(address(lottery).balance, fee);
    }

    function test_CloseLotteryAfterDeadline() public {
        uint256 fee = lottery.ENTRY_FEE();
        vm.prank(alice);
        lottery.enterLottery{value: fee}();
        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();
        assertEq(uint256(lottery.state()), uint256(Lottery.LotteryState.CALCULATING));
        assertEq(coordinator.requestCount(), 1);
        assertEq(lottery.lastRequestId(), 1);
    }

    function test_RevertWhen_ClosingWithoutPlayers() public {
        vm.warp(lottery.roundEndTime());
        vm.expectRevert(bytes("No players"));
        lottery.closeLottery();
    }

    function test_RevertWhen_ClosingTwice() public {
        uint256 fee = lottery.ENTRY_FEE();
        vm.prank(alice);
        lottery.enterLottery{value: fee}();
        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();
        vm.expectRevert(bytes("Lottery is not open"));
        lottery.closeLottery();
    }

    function test_VRFCallbackRecordsRandomWord() public {
        uint256 fee = lottery.ENTRY_FEE();
        vm.prank(alice);
        lottery.enterLottery{value: fee}();
        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();
        uint256[] memory words = new uint256[](1);
        words[0] = 42;
        coordinator.fulfill(address(lottery), lottery.lastRequestId(), words);
        assertTrue(lottery.randomnessFulfilled());
        assertEq(lottery.randomWord(), 42);
    }

    function test_RevertWhen_NonCoordinatorCallsCallback() public {
        uint256[] memory words = new uint256[](1);
        words[0] = 42;
        vm.expectRevert();
        vm.prank(alice);
        lottery.rawFulfillRandomWords(1, words);
    }

    function test_RevertWhen_WrongRequestIdIsFulfilled() public {
        uint256 fee = lottery.ENTRY_FEE();
        vm.prank(alice);
        lottery.enterLottery{value: fee}();
        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();
        uint256[] memory words = new uint256[](1);
        words[0] = 42;
        vm.expectRevert(bytes("Unknown request ID"));
        coordinator.fulfill(address(lottery), 999, words);
    }

    function test_VRFSelectsWinnerFromPlayers() public {
        uint256 fee = lottery.ENTRY_FEE();
        vm.prank(alice);
        lottery.enterLottery{value: fee}();
        vm.prank(bob);
        lottery.enterLottery{value: fee}();
        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();
        uint256[] memory words = new uint256[](1);
        words[0] = 1;
        coordinator.fulfill(address(lottery), lottery.lastRequestId(), words);
        assertEq(lottery.winner(), bob);
        assertEq(uint256(lottery.state()), uint256(Lottery.LotteryState.PAYOUT));
    }

    function test_SuccessfulDrawClearsRefundLiabilityAndAssignsPrize() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.prank(bob);
        lottery.enterLottery{value: fee}();

        uint256 expectedPrizePool = 2 * fee;

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        uint256[] memory words = new uint256[](1);
        words[0] = 1;

        coordinator.fulfill(address(lottery), lottery.lastRequestId(), words);

        assertEq(lottery.winner(), bob);
        assertEq(uint256(lottery.state()), uint256(Lottery.LotteryState.PAYOUT));
        assertEq(lottery.totalRefundLiability(), 0);
        assertEq(lottery.pendingWinnings(bob), expectedPrizePool);
        assertEq(address(lottery).balance, expectedPrizePool);
    }

    function test_OldRoundRefundRemainsClaimableAfterNextRoundStarts() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        vm.warp(block.timestamp + lottery.VRF_TIMEOUT());
        lottery.abortLottery();

        assertEq(lottery.totalRefundLiability(), fee);

        lottery.startNextRound();

        assertEq(lottery.currentRoundId(), 2);

        // A player can enter round 2 while round 1's refund remains outstanding.
        vm.prank(bob);
        lottery.enterLottery{value: fee}();

        assertEq(lottery.totalRefundLiability(), 2 * fee);

        // Round 1's refund remains claimable by its original round ID.
        vm.prank(alice);
        lottery.withdrawRefundForRound(1);

        assertEq(lottery.roundRefundCredits(1, alice), 0);
        assertEq(lottery.refundCredits(alice), 0);
        assertEq(lottery.totalRefundLiability(), fee);
        assertEq(address(lottery).balance, fee);
    }

    function test_SamePlayerCanClaimRefundsFromMultipleRounds() public {
        uint256 fee = lottery.ENTRY_FEE();

        // Alice enters round 1.
        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        // Abort round 1 so Alice becomes eligible for a refund.
        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        vm.warp(block.timestamp + lottery.VRF_TIMEOUT());
        lottery.abortLottery();

        assertEq(lottery.roundRefundCredits(1, alice), fee);
        assertEq(lottery.refundCredits(alice), fee);
        assertEq(lottery.totalRefundLiability(), fee);

        // Start round 2; Alice enters again.
        lottery.startNextRound();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        // Abort round 2 as well.
        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        vm.warp(block.timestamp + lottery.VRF_TIMEOUT());
        lottery.abortLottery();

        assertEq(lottery.roundRefundCredits(1, alice), fee);
        assertEq(lottery.roundRefundCredits(2, alice), fee);
        assertEq(lottery.refundCredits(alice), 2 * fee);
        assertEq(lottery.totalRefundLiability(), 2 * fee);
        assertEq(address(lottery).balance, 2 * fee);

        // Claim round 1: round 2's refund must remain intact.
        vm.prank(alice);
        lottery.withdrawRefundForRound(1);

        assertEq(lottery.roundRefundCredits(1, alice), 0);
        assertEq(lottery.roundRefundCredits(2, alice), fee);
        assertEq(lottery.refundCredits(alice), fee);
        assertEq(lottery.totalRefundLiability(), fee);
        assertEq(address(lottery).balance, fee);

        // Claim round 2: all refund accounting should now be cleared.
        vm.prank(alice);
        lottery.withdrawRefundForRound(2);

        assertEq(lottery.roundRefundCredits(1, alice), 0);
        assertEq(lottery.roundRefundCredits(2, alice), 0);
        assertEq(lottery.refundCredits(alice), 0);
        assertEq(lottery.totalRefundLiability(), 0);
        assertEq(address(lottery).balance, 0);
    }

    function test_OlderRefundRemainsLiableAfterNewRoundSuccessfulDraw() public {
        uint256 fee = lottery.ENTRY_FEE();

        // Alice enters round 1, which is later aborted.
        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        vm.warp(block.timestamp + lottery.VRF_TIMEOUT());
        lottery.abortLottery();

        assertEq(lottery.totalRefundLiability(), fee);

        // Round 2 starts; Bob enters and wins its successful draw.
        lottery.startNextRound();

        vm.prank(bob);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        uint256[] memory words = new uint256[](1);
        words[0] = 0;

        coordinator.fulfill(address(lottery), lottery.lastRequestId(), words);

        // Round 1's refund remains owed; round 2's fee becomes prize liability.
        assertEq(lottery.currentRoundId(), 2);
        assertEq(uint256(lottery.state()), uint256(Lottery.LotteryState.PAYOUT));
        assertEq(uint256(lottery.roundRefundCredits(1, alice)), fee);
        assertEq(lottery.refundCredits(alice), fee);
        assertEq(lottery.totalRefundLiability(), fee);
        assertEq(lottery.pendingWinnings(bob), fee);
        assertEq(lottery.totalPrizeLiability(), fee);
        assertEq(address(lottery).balance, 2 * fee);

        // Alice can still claim her refund from round 1.
        vm.prank(alice);
        lottery.withdrawRefundForRound(1);

        assertEq(lottery.roundRefundCredits(1, alice), 0);
        assertEq(lottery.refundCredits(alice), 0);
        assertEq(lottery.totalRefundLiability(), 0);
        assertEq(lottery.totalPrizeLiability(), fee);
        assertEq(address(lottery).balance, fee);
    }

    function test_AdvanceExpiredEmptyRoundWithoutVRF() public {
        uint256 initialRequestCount = coordinator.requestCount();

        vm.warp(lottery.roundEndTime());

        lottery.advanceEmptyRound();

        assertEq(lottery.currentRoundId(), 2);
        assertEq(uint256(lottery.state()), uint256(Lottery.LotteryState.OPEN));
        assertEq(lottery.roundEndTime(), block.timestamp + lottery.ROUND_DURATION());
        assertEq(coordinator.requestCount(), initialRequestCount);
        assertEq(lottery.getPlayersCount(), 0);
    }

    function test_StartNextRoundPreservesUnclaimedPrize() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        uint256 requestId = lottery.lastRequestId();
        uint256[] memory words = new uint256[](1);
        words[0] = 0;

        coordinator.fulfill(address(lottery), requestId, words);

        // Round 1's prize remains unclaimed.
        assertEq(lottery.pendingWinnings(alice), fee);
        assertEq(lottery.totalPrizeLiability(), fee);

        lottery.startNextRound();

        assertEq(lottery.currentRoundId(), 2);
        assertEq(uint256(lottery.state()), uint256(Lottery.LotteryState.OPEN));
        assertEq(lottery.roundEndTime(), block.timestamp + lottery.ROUND_DURATION());

        // Starting round 2 must not erase round 1's prize.
        assertEq(lottery.pendingWinnings(alice), fee);
        assertEq(lottery.totalPrizeLiability(), fee);

        // A player can enter the new round.
        vm.prank(bob);
        lottery.enterLottery{value: fee}();

        assertEq(lottery.getPlayersCount(), 2);
        assertEq(address(lottery).balance, 2 * fee);
    }

    function test_RevertWhen_PlayerWithdrawsRefundAfterSuccessfulDraw() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        uint256[] memory words = new uint256[](1);
        words[0] = 0;

        coordinator.fulfill(address(lottery), lottery.lastRequestId(), words);

        assertEq(uint256(lottery.state()), uint256(Lottery.LotteryState.PAYOUT));

        assertEq(lottery.refundCredits(alice), fee);
        assertEq(lottery.totalRefundLiability(), 0);

        vm.prank(alice);
        vm.expectRevert(bytes("Refunds not available"));
        lottery.withdrawRefund();

        assertEq(lottery.refundCredits(alice), fee);
        assertEq(lottery.pendingWinnings(alice), fee);
        assertEq(address(lottery).balance, fee);
    }

    function test_VRFSelectsFirstPlayerWhenIndexIsZero() public {
        uint256 fee = lottery.ENTRY_FEE();
        vm.prank(alice);
        lottery.enterLottery{value: fee}();
        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();
        uint256[] memory words = new uint256[](1);
        words[0] = 0;
        coordinator.fulfill(address(lottery), lottery.lastRequestId(), words);
        assertEq(lottery.winner(), alice);
    }

    function test_WinnerCanWithdrawPrize() public {
        uint256 fee = lottery.ENTRY_FEE();
        vm.prank(alice);
        lottery.enterLottery{value: fee}();
        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();
        uint256[] memory words = new uint256[](1);
        words[0] = 0;
        coordinator.fulfill(address(lottery), lottery.lastRequestId(), words);
        assertEq(lottery.pendingWinnings(alice), fee);
        uint256 balanceBefore = alice.balance;
        vm.prank(alice);
        lottery.withdrawWinnings();
        assertEq(alice.balance, balanceBefore + fee);
        assertEq(lottery.pendingWinnings(alice), 0);
    }

    function test_RevertWhen_WithdrawTwice() public {
        uint256 fee = lottery.ENTRY_FEE();
        vm.prank(alice);
        lottery.enterLottery{value: fee}();
        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();
        uint256[] memory words = new uint256[](1);
        words[0] = 0;
        coordinator.fulfill(address(lottery), lottery.lastRequestId(), words);
        vm.prank(alice);
        lottery.withdrawWinnings();
        vm.expectRevert(bytes("No winnings to withdraw"));
        vm.prank(alice);
        lottery.withdrawWinnings();
    }

    function test_RevertWhen_WinnerRejectsETH() public {
        uint256 fee = lottery.ENTRY_FEE();
        RejectEther rejector = new RejectEther();
        vm.deal(address(rejector), fee);
        rejector.enter(lottery, fee);
        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();
        uint256[] memory words = new uint256[](1);
        words[0] = 0;
        coordinator.fulfill(address(lottery), lottery.lastRequestId(), words);
        assertEq(lottery.pendingWinnings(address(rejector)), fee);
        vm.expectRevert(bytes("Withdrawal failed"));
        rejector.withdraw(lottery);
        assertEq(lottery.pendingWinnings(address(rejector)), fee);
    }

    function test_ReentrancyCannotWithdrawPrizeTwice() public {
        uint256 fee = lottery.ENTRY_FEE();
        ReentrantWinner attacker = new ReentrantWinner(lottery);

        vm.deal(address(attacker), fee);
        attacker.enter(fee);

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        uint256[] memory words = new uint256[](1);
        words[0] = 0;

        coordinator.fulfill(address(lottery), lottery.lastRequestId(), words);

        assertEq(lottery.pendingWinnings(address(attacker)), fee);

        attacker.withdraw();

        assertEq(attacker.receiveCount(), 1);
        assertTrue(attacker.reentryBlocked());
        assertEq(lottery.pendingWinnings(address(attacker)), 0);
        assertEq(address(attacker).balance, fee);
    }

    function test_PrizePoolExcludesUnrelatedETH() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.prank(bob);
        lottery.enterLottery{value: fee * 2}();

        uint256 extraBalance = 1 ether;
        vm.deal(address(lottery), address(lottery).balance + extraBalance);

        uint256 expectedPrizePool = fee * 3;

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        uint256[] memory words = new uint256[](1);
        words[0] = 0;

        coordinator.fulfill(address(lottery), lottery.lastRequestId(), words);

        assertEq(lottery.winner(), alice);
        assertEq(lottery.pendingWinnings(alice), expectedPrizePool);
        assertEq(lottery.pendingWinnings(bob), 0);
        assertEq(address(lottery).balance, expectedPrizePool + extraBalance);
    }

    function test_ForcedETHIsExcludedFromPrizePool() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        // Force-send 1 ETH; it is not part of this round's prize.
        ForceEther forceEther = new ForceEther{value: 1 ether}();
        forceEther.forceSend(payable(address(lottery)));

        uint256 expectedPrizePool = fee;
        assertEq(address(lottery).balance, expectedPrizePool + 1 ether);

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        uint256[] memory words = new uint256[](1);
        words[0] = 0;

        coordinator.fulfill(address(lottery), lottery.lastRequestId(), words);

        assertEq(lottery.winner(), alice);
        assertEq(lottery.pendingWinnings(alice), expectedPrizePool);
        assertEq(address(lottery).balance, 1 ether + expectedPrizePool);
    }

    function test_RevertWhen_RandomnessIsFulfilledTwice() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.prank(bob);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        uint256 requestId = lottery.lastRequestId();

        uint256[] memory firstWords = new uint256[](1);
        firstWords[0] = 0;

        coordinator.fulfill(address(lottery), requestId, firstWords);

        assertEq(lottery.winner(), alice);
        assertEq(lottery.randomWord(), 0);

        uint256[] memory secondWords = new uint256[](1);
        secondWords[0] = 1;

        vm.expectRevert(bytes("Lottery not calculating"));
        coordinator.fulfill(address(lottery), requestId, secondWords);

        // The second callback must not change the original result.
        assertEq(lottery.winner(), alice);
        assertEq(lottery.randomWord(), 0);
    }

    function test_RevertWhen_VRFRequestFails() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());

        coordinator.setShouldRevertRequest(true);

        vm.expectRevert(bytes("Mock: VRF request failed"));
        lottery.closeLottery();

        // The failed transaction must roll back the lottery state.
        assertEq(uint256(lottery.state()), uint256(Lottery.LotteryState.OPEN));
        assertEq(lottery.getPlayersCount(), 1);
        assertEq(lottery.players(0), alice);
        assertEq(lottery.lastRequestId(), 0);

        // The mock must not record a successful request.
        assertEq(coordinator.requestCount(), 0);
        assertEq(coordinator.lastRequestId(), 0);
    }

    function test_RevertWhen_AbortingBeforeVRFTimeout() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        vm.warp(lottery.randomnessRequestTime() + lottery.VRF_TIMEOUT() - 1);

        vm.expectRevert(bytes("VRF timeout not reached"));
        lottery.abortLottery();
    }

    function test_AbortOlderRoundAfterNextRoundStarts() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        uint256 oldRequestId = lottery.lastRequestId();
        vm.warp(lottery.randomnessRequestTime() + lottery.VRF_TIMEOUT());

        lottery.abortLottery();

        assertEq(uint256(lottery.state()), uint256(Lottery.LotteryState.REFUND));

        lottery.startNextRound();

        assertEq(lottery.currentRoundId(), 2);

        vm.prank(bob);
        lottery.enterLottery{value: fee}();

        // Aborting round 1 again must fail because it is already in REFUND.
        vm.expectRevert(bytes("Round not calculating"));
        lottery.abortRound(1);

        // The current round must remain open and its VRF request untouched.
        assertEq(uint256(lottery.state()), uint256(Lottery.LotteryState.OPEN));
        assertEq(lottery.lastRequestId(), oldRequestId);
        assertEq(lottery.totalRefundLiability(), fee * 2);
    }

    function test_RevertWhen_OldRoundVRFCallbackArrivesAfterAbort() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        uint256 oldRequestId = lottery.lastRequestId();

        vm.warp(lottery.randomnessRequestTime() + lottery.VRF_TIMEOUT());
        lottery.abortLottery();
        lottery.startNextRound();

        vm.prank(bob);
        lottery.enterLottery{value: fee}();

        uint256 balanceBefore = address(lottery).balance;
        uint256 refundLiabilityBefore = lottery.totalRefundLiability();

        uint256[] memory words = new uint256[](1);
        words[0] = 0;

        vm.expectRevert(bytes("Lottery not calculating"));
        coordinator.fulfill(address(lottery), oldRequestId, words);

        assertEq(lottery.currentRoundId(), 2);
        assertEq(uint256(lottery.state()), uint256(Lottery.LotteryState.OPEN));
        assertEq(lottery.totalRefundLiability(), refundLiabilityBefore);
        assertEq(address(lottery).balance, balanceBefore);
        assertEq(lottery.pendingWinnings(alice), 0);
        assertEq(lottery.roundRefundCredits(1, alice), fee);
    }

    function test_AbortLotteryAfterVRFTimeout() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        vm.warp(lottery.randomnessRequestTime() + lottery.VRF_TIMEOUT());

        lottery.abortLottery();

        assertEq(uint256(lottery.state()), uint256(Lottery.LotteryState.REFUND));
    }

    function test_PlayersCanWithdrawExactRefunds() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee + 0.005 ether}();

        vm.prank(bob);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        vm.warp(lottery.randomnessRequestTime() + lottery.VRF_TIMEOUT());
        lottery.abortLottery();

        uint256 aliceBalanceBefore = alice.balance;
        vm.prank(alice);
        lottery.withdrawRefund();

        assertEq(alice.balance, aliceBalanceBefore + fee + 0.005 ether);
        assertEq(lottery.refundCredits(alice), 0);
        assertEq(lottery.totalRefundLiability(), fee);

        uint256 bobBalanceBefore = bob.balance;
        vm.prank(bob);
        lottery.withdrawRefund();

        assertEq(bob.balance, bobBalanceBefore + fee);
        assertEq(lottery.refundCredits(bob), 0);
        assertEq(address(lottery).balance, 0);
        assertEq(lottery.totalRefundLiability(), 0);
    }

    function test_RevertWhen_VRFCallbackArrivesAfterAbort() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        uint256 requestId = lottery.lastRequestId();

        vm.warp(lottery.randomnessRequestTime() + lottery.VRF_TIMEOUT());
        lottery.abortLottery();

        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 0;

        vm.expectRevert(bytes("Lottery not calculating"));
        coordinator.fulfill(address(lottery), requestId, randomWords);

        assertEq(uint256(lottery.state()), uint256(Lottery.LotteryState.REFUND));
        assertEq(lottery.winner(), address(0));
    }

    function test_RevertWhen_RefundTransferFails() public {
        uint256 fee = lottery.ENTRY_FEE();

        RejectEther rejecter = new RejectEther();
        vm.deal(address(rejecter), fee);

        rejecter.enter(lottery, fee);

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        vm.warp(lottery.randomnessRequestTime() + lottery.VRF_TIMEOUT());
        lottery.abortLottery();

        assertEq(lottery.refundCredits(address(rejecter)), fee);

        vm.expectRevert(bytes("Refund transfer failed"));
        rejecter.withdrawRefund(lottery);

        // The failed transfer must restore the original refund credit.
        assertEq(lottery.refundCredits(address(rejecter)), fee);
        assertEq(uint256(lottery.state()), uint256(Lottery.LotteryState.REFUND));
    }

    function test_RevertWhen_RefundClaimedThroughBothWithdrawalFunctions() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        vm.warp(lottery.randomnessRequestTime() + lottery.VRF_TIMEOUT());
        lottery.abortLottery();

        // First claim through the legacy function.
        vm.prank(alice);
        lottery.withdrawRefund();

        assertEq(lottery.refundCredits(alice), 0);
        assertEq(lottery.roundRefundCredits(1, alice), 0);
        assertEq(lottery.totalRefundLiability(), 0);

        // The round-specific function must not pay the same refund again.
        vm.prank(alice);
        vm.expectRevert(bytes("No refund available"));
        lottery.withdrawRefundForRound(1);

        assertEq(address(lottery).balance, 0);
        assertEq(alice.balance, 1 ether);
    }

    function test_RevertWhen_RefundClaimedRoundFirstThenLegacyFunction() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        vm.warp(lottery.randomnessRequestTime() + lottery.VRF_TIMEOUT());
        lottery.abortLottery();

        // First claim through the round-specific function.
        vm.prank(alice);
        lottery.withdrawRefundForRound(1);

        assertEq(lottery.refundCredits(alice), 0);
        assertEq(lottery.roundRefundCredits(1, alice), 0);
        assertEq(lottery.totalRefundLiability(), 0);

        // The legacy function must not pay the same refund again.
        vm.prank(alice);
        vm.expectRevert(bytes("No refund available"));
        lottery.withdrawRefund();

        assertEq(address(lottery).balance, 0);
        assertEq(alice.balance, 1 ether);
    }

    function test_RevertWhen_RefundWithdrawnTwice() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        vm.warp(lottery.randomnessRequestTime() + lottery.VRF_TIMEOUT());
        lottery.abortLottery();

        vm.prank(alice);
        lottery.withdrawRefund();

        assertEq(lottery.refundCredits(alice), 0);

        vm.prank(alice);
        vm.expectRevert(bytes("No refund available"));
        lottery.withdrawRefund();
    }

    function test_RevertWhen_NonPlayerWithdrawsRefund() public {
        uint256 fee = lottery.ENTRY_FEE();
        address charlie = makeAddr("charlie");

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        vm.warp(lottery.randomnessRequestTime() + lottery.VRF_TIMEOUT());
        lottery.abortLottery();

        vm.prank(charlie);
        vm.expectRevert(bytes("No refund available"));
        lottery.withdrawRefund();

        assertEq(lottery.refundCredits(charlie), 0);
        assertEq(lottery.refundCredits(alice), fee);
    }

    function test_ForcedEtherDoesNotChangePlayerRefundAmounts() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.prank(bob);
        lottery.enterLottery{value: fee}();

        // Force an extra 1 ETH into the lottery.
        ForceEther forceEther = new ForceEther{value: 1 ether}();
        forceEther.forceSend(payable(address(lottery)));

        assertEq(address(lottery).balance, 1 ether + 2 * fee);

        // Close the round and trigger the refund state after timeout.
        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        vm.warp(lottery.randomnessRequestTime() + lottery.VRF_TIMEOUT());
        lottery.abortLottery();

        // Each player must receive exactly their recorded contribution.
        uint256 aliceBalanceBefore = alice.balance;
        vm.prank(alice);
        lottery.withdrawRefund();
        assertEq(alice.balance, aliceBalanceBefore + fee);
        assertEq(lottery.refundCredits(alice), 0);

        uint256 bobBalanceBefore = bob.balance;
        vm.prank(bob);
        lottery.withdrawRefund();
        assertEq(bob.balance, bobBalanceBefore + fee);
        assertEq(lottery.refundCredits(bob), 0);

        // The forced ETH remains in the contract after both refunds.
        assertEq(address(lottery).balance, 1 ether);
    }

    function test_ReentrancyCannotWithdrawRefundTwice() public {
        uint256 fee = lottery.ENTRY_FEE();

        ReentrantRefundRecipient attacker = new ReentrantRefundRecipient(lottery);

        vm.deal(address(attacker), fee);
        attacker.enter(fee);

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        vm.warp(lottery.randomnessRequestTime() + lottery.VRF_TIMEOUT());
        lottery.abortLottery();

        assertEq(lottery.refundCredits(address(attacker)), fee);

        attacker.withdrawRefund();

        assertEq(attacker.receiveCount(), 1);
        assertTrue(attacker.reentryBlocked());
        assertEq(lottery.refundCredits(address(attacker)), 0);
        assertEq(address(attacker).balance, fee);
        assertEq(address(lottery).balance, 0);
    }

    function test_VRFCallbackAtExactTimeoutBeforeAbort() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        // Move to the exact VRF timeout.
        vm.warp(lottery.randomnessRequestTime() + lottery.VRF_TIMEOUT());

        uint256[] memory words = new uint256[](1);
        words[0] = 0;

        // Callback executes before abortLottery().
        coordinator.fulfill(address(lottery), lottery.lastRequestId(), words);

        assertEq(uint256(lottery.state()), uint256(Lottery.LotteryState.PAYOUT));
        assertEq(lottery.winner(), alice);
        assertEq(lottery.pendingWinnings(alice), fee);
    }

    function test_ManagerCanRecoverSurplusWithOlderRefundAndCurrentRoundOpen() public {
        uint256 fee = lottery.ENTRY_FEE();
        uint256 surplus = 1 ether;

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        vm.warp(lottery.randomnessRequestTime() + lottery.VRF_TIMEOUT());
        lottery.abortLottery();

        lottery.startNextRound();

        vm.prank(bob);
        lottery.enterLottery{value: fee}();

        ForceEther forceEther = new ForceEther{value: surplus}();
        forceEther.forceSend(payable(address(lottery)));

        uint256 managerBalanceBefore = address(this).balance;

        lottery.recoverSurplus();

        assertEq(address(this).balance, managerBalanceBefore + surplus);
        assertEq(lottery.totalRefundLiability(), 2 * fee);
        assertEq(address(lottery).balance, 2 * fee);
        assertEq(uint256(lottery.state()), uint256(Lottery.LotteryState.OPEN));
    }

    function test_ManagerCanRecoverOnlySurplusAfterRefundAbort() public {
        uint256 fee = lottery.ENTRY_FEE();
        uint256 surplus = 1 ether;

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.prank(bob);
        lottery.enterLottery{value: fee}();

        // Force 1 ETH into the lottery.
        ForceEther forceEther = new ForceEther{value: surplus}();
        forceEther.forceSend(payable(address(lottery)));

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        vm.warp(lottery.randomnessRequestTime() + lottery.VRF_TIMEOUT());
        lottery.abortLottery();

        assertEq(address(lottery).balance, surplus + 2 * fee);
        assertEq(lottery.totalRefundLiability(), 2 * fee);

        uint256 managerBalanceBefore = address(this).balance;

        lottery.recoverSurplus();

        assertEq(address(this).balance, managerBalanceBefore + surplus);
        assertEq(address(lottery).balance, 2 * fee);
        assertEq(lottery.totalRefundLiability(), 2 * fee);
        assertEq(lottery.refundCredits(alice), fee);
        assertEq(lottery.refundCredits(bob), fee);
    }

    function test_RevertWhen_NonManagerRecoversSurplus() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        vm.warp(lottery.randomnessRequestTime() + lottery.VRF_TIMEOUT());
        lottery.abortLottery();

        vm.deal(address(lottery), address(lottery).balance + 1 ether);

        vm.prank(alice);
        vm.expectRevert(bytes("Only manager"));
        lottery.recoverSurplus();
    }

    function test_ManagerCannotRecoverUnclaimedPrizeLiability() public {
        uint256 fee = lottery.ENTRY_FEE();
        uint256 surplus = 1 ether;

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        uint256[] memory words = new uint256[](1);
        words[0] = 0;
        coordinator.fulfill(address(lottery), lottery.lastRequestId(), words);

        ForceEther forceEther = new ForceEther{value: surplus}();
        forceEther.forceSend(payable(address(lottery)));

        assertEq(lottery.pendingWinnings(alice), fee);
        assertEq(lottery.totalPrizeLiability(), fee);

        uint256 balanceBefore = address(lottery).balance;
        uint256 managerBalanceBefore = address(this).balance;

        lottery.recoverSurplus();

        assertEq(address(this).balance, managerBalanceBefore + surplus);
        assertEq(address(lottery).balance, balanceBefore - surplus);
        assertEq(address(lottery).balance, fee);
        assertEq(lottery.pendingWinnings(alice), fee);
        assertEq(lottery.totalPrizeLiability(), fee);
    }

    function test_ManagerCanRecoverSurplusBeforeRefundState() public {
        uint256 surplus = 1 ether;

        vm.deal(address(lottery), surplus);

        uint256 managerBalanceBefore = address(this).balance;

        lottery.recoverSurplus();

        assertEq(address(this).balance, managerBalanceBefore + surplus);
        assertEq(address(lottery).balance, 0);
        assertEq(uint256(lottery.state()), uint256(Lottery.LotteryState.OPEN));
    }

    function test_RevertWhen_NoSurplusToRecover() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        vm.warp(lottery.randomnessRequestTime() + lottery.VRF_TIMEOUT());
        lottery.abortLottery();

        // The full contract balance is owed to Alice.
        assertEq(address(lottery).balance, fee);
        assertEq(lottery.totalRefundLiability(), fee);

        vm.expectRevert(bytes("No surplus to recover"));
        lottery.recoverSurplus();
    }

    function test_RecoveryAfterPartialRefundPreservesRemainingLiability() public {
        uint256 fee = lottery.ENTRY_FEE();
        uint256 surplus = 1 ether;

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.prank(bob);
        lottery.enterLottery{value: fee}();

        ForceEther forceEther = new ForceEther{value: surplus}();
        forceEther.forceSend(payable(address(lottery)));

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        vm.warp(lottery.randomnessRequestTime() + lottery.VRF_TIMEOUT());
        lottery.abortLottery();

        assertEq(lottery.totalRefundLiability(), 2 * fee);

        // Alice withdraws her refund.
        vm.prank(alice);
        lottery.withdrawRefund();

        assertEq(lottery.totalRefundLiability(), fee);
        assertEq(lottery.refundCredits(alice), 0);
        assertEq(lottery.refundCredits(bob), fee);

        // Manager recovers only the 1 ETH surplus.
        uint256 managerBalanceBefore = address(this).balance;
        lottery.recoverSurplus();

        assertEq(address(this).balance, managerBalanceBefore + surplus);
        assertEq(address(lottery).balance, fee);
        assertEq(lottery.totalRefundLiability(), fee);
        assertEq(lottery.refundCredits(bob), fee);

        // Bob can still withdraw his full refund.
        uint256 bobBalanceBefore = bob.balance;
        vm.prank(bob);
        lottery.withdrawRefund();

        assertEq(bob.balance, bobBalanceBefore + fee);
        assertEq(lottery.totalRefundLiability(), 0);
        assertEq(address(lottery).balance, 0);
    }

    function test_RevertWhen_AlternativeRecipientRejectsETH() public {
        uint256 fee = lottery.ENTRY_FEE();
        RejectEther rejector = new RejectEther();
        RejectEther recipient = new RejectEther();

        vm.deal(address(rejector), fee);
        rejector.enter(lottery, fee);

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        uint256[] memory words = new uint256[](1);
        words[0] = 0;
        coordinator.fulfill(address(lottery), lottery.lastRequestId(), words);

        assertEq(lottery.pendingWinnings(address(rejector)), fee);

        vm.expectRevert(bytes("Withdrawal failed"));
        rejector.withdrawWinningsTo(lottery, payable(address(recipient)));

        // The failed transfer must not erase the winner's claim.
        assertEq(lottery.pendingWinnings(address(rejector)), fee);
        assertEq(address(lottery).balance, fee);
    }

    function test_WinnerCanRedirectPrizeToAnotherAddress() public {
        uint256 fee = lottery.ENTRY_FEE();
        RejectEther rejector = new RejectEther();
        address payable recipient = payable(makeAddr("recipient"));

        vm.deal(address(rejector), fee);
        rejector.enter(lottery, fee);

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        uint256[] memory words = new uint256[](1);
        words[0] = 0;
        coordinator.fulfill(address(lottery), lottery.lastRequestId(), words);

        assertEq(lottery.pendingWinnings(address(rejector)), fee);

        uint256 recipientBalanceBefore = recipient.balance;

        rejector.withdrawWinningsTo(lottery, recipient);

        assertEq(recipient.balance, recipientBalanceBefore + fee);
        assertEq(lottery.pendingWinnings(address(rejector)), 0);
    }

    function test_RevertWhen_NonWinnerRedirectsPrize() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        uint256[] memory words = new uint256[](1);
        words[0] = 0;
        coordinator.fulfill(address(lottery), lottery.lastRequestId(), words);

        vm.expectRevert(bytes("No winnings to withdraw"));
        vm.prank(bob);
        lottery.withdrawWinningsTo(payable(bob));
    }

    function test_RevertWhen_RedirectingPrizeToZeroAddress() public {
        uint256 fee = lottery.ENTRY_FEE();

        vm.prank(alice);
        lottery.enterLottery{value: fee}();

        vm.warp(lottery.roundEndTime());
        lottery.closeLottery();

        uint256[] memory words = new uint256[](1);
        words[0] = 0;
        coordinator.fulfill(address(lottery), lottery.lastRequestId(), words);

        vm.expectRevert(bytes("Invalid recipient"));
        vm.prank(alice);
        lottery.withdrawWinningsTo(payable(address(0)));

        assertEq(lottery.pendingWinnings(alice), fee);
    }
}
