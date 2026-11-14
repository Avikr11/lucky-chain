// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

contract ForkCallbackGasTest is Test {
    function test_ReplayFullVRFFulfillment() public {
        if (
            !vm.envExists("ALT_ARCHIVE_RPC") ||
            !vm.envExists("CONTRACT") ||
            !vm.envExists("VRF_COORDINATOR") ||
            !vm.envExists("FULFILLMENT_TX_SENDER") ||
            !vm.envExists("FULFILLMENT_CALLDATA")
        ) {
            vm.skip(true);
            return;
        }

        string memory rpcUrl = vm.envString("ALT_ARCHIVE_RPC");
        vm.createSelectFork(rpcUrl, 12120162);

        address lottery = vm.envAddress("CONTRACT");
        address coordinator = vm.envAddress("VRF_COORDINATOR");
        address sender = vm.envAddress("FULFILLMENT_TX_SENDER");
        bytes memory fulfillmentData = vm.envBytes("FULFILLMENT_CALLDATA");

        // Replay the three transactions preceding the original VRF fulfillment.
        vm.transact(0xd6c084a652d1be8717755f395db2afa508bfee52b088e8c7e91a9d97d09d06f5);
        vm.transact(0x5e6df381bb6c33d2f73ee2de5e60d0986eda9791a55c48048d440e177d190748);
        vm.transact(0x8c6a87af78335ee5cf20c0ec1efca0d70c448e9a8d762fba7cc164f370268e66);

        // Reproduce the original fulfillment block context.
        vm.roll(12120163);
        vm.warp(1794502548);

        // Reproduce the original transaction sender.
        vm.prank(sender, sender);

        // Original transaction gas limit.
        (bool success, bytes memory result) = coordinator.call{gas: 888639}(fulfillmentData);

        emit log_named_uint("Coordinator call success", success ? 1 : 0);

        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }

        // Check the actual Lottery state after coordinator execution.
        (bool stateSuccess, bytes memory stateResult) = lottery.staticcall(abi.encodeWithSignature("state()"));

        require(stateSuccess, "Could not read Lottery state");

        uint256 lotteryState = abi.decode(stateResult, (uint256));

        assertEq(lotteryState, 2, "Lottery did not reach PAYOUT state");
    }
}
