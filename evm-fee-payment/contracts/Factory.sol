// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CREATE2 Factory for deterministic UserWallet deployment
/// @notice Deploys contracts at deterministic addresses using CREATE2
contract Factory {
    /// @notice Deploy a contract using CREATE2
    /// @param salt A unique salt for deterministic address
    /// @param bytecode The init code of the contract to deploy
    /// @return addr The deployed contract address
    function deploy(bytes32 salt, bytes memory bytecode) external returns(address addr) {
        assembly {
            addr := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
            if iszero(extcodesize(addr)) { revert(0, 0) } // revert if deployment failed
        }
    }
}
