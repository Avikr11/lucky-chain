// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

contract MockVRFCoordinatorV2Plus {
    uint256 public nextRequestId = 1;
    uint256 public lastRequestId;
    uint256 public requestCount;
    uint256 public lastCallbackGasUsed;

    bool public shouldRevertRequest;

    function setShouldRevertRequest(bool value) external {
        shouldRevertRequest = value;
    }

    function requestRandomWords(VRFV2PlusClient.RandomWordsRequest calldata) external returns (uint256 requestId) {
        require(!shouldRevertRequest, "Mock: VRF request failed");

        requestId = nextRequestId++;
        lastRequestId = requestId;
        requestCount++;
    }

    // Existing unrestricted fulfillment, retained for existing tests.
    function fulfill(address consumer, uint256 requestId, uint256[] calldata randomWords) external {
        (bool success, bytes memory returnData) =
            consumer.call(abi.encodeWithSignature("rawFulfillRandomWords(uint256,uint256[])", requestId, randomWords));

        if (!success) {
            assembly {
                revert(add(returnData, 32), mload(returnData))
            }
        }
    }

    // Simulates Chainlink fulfillment with a bounded callback gas limit.
    function fulfillWithGas(
        address consumer,
        uint256 requestId,
        uint256[] calldata randomWords,
        uint32 callbackGasLimit
    ) external {
        uint256 gasBefore = gasleft();

        (bool success, bytes memory returnData) = consumer.call{gas: callbackGasLimit}(
            abi.encodeWithSignature("rawFulfillRandomWords(uint256,uint256[])", requestId, randomWords)
        );

        lastCallbackGasUsed = gasBefore - gasleft();

        if (!success) {
            assembly {
                revert(add(returnData, 32), mload(returnData))
            }
        }
    }
}
