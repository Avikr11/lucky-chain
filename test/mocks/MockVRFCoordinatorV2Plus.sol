// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

contract MockVRFCoordinatorV2Plus {
    uint256 public nextRequestId = 1;
    uint256 public lastRequestId;
    uint256 public requestCount;

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

    function fulfill(address consumer, uint256 requestId, uint256[] calldata randomWords) external {
        (bool success, bytes memory returnData) =
            consumer.call(abi.encodeWithSignature("rawFulfillRandomWords(uint256,uint256[])", requestId, randomWords));

        if (!success) {
            assembly {
                revert(add(returnData, 32), mload(returnData))
            }
        }
    }
}
