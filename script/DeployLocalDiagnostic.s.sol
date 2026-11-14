// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {Lottery} from "../src/Lottery.sol";
import {MockVRFCoordinatorV2Plus} from "../test/mocks/MockVRFCoordinatorV2Plus.sol";

contract DeployLocalDiagnostic is Script {
    function run() external {
        require(block.chainid == 31337, "Local Anvil network required");

        vm.startBroadcast();

        MockVRFCoordinatorV2Plus coordinator = new MockVRFCoordinatorV2Plus();
        Lottery lottery = new Lottery(address(coordinator), 123, bytes32(uint256(456)));

        vm.stopBroadcast();

        console2.log("Coordinator:", address(coordinator));
        console2.log("Lottery:", address(lottery));
    }
}
