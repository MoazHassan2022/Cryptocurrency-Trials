// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ParentFactory {
    /**
     * @dev Deploys a contract using CREATE2.
     * @param salt The salt for the deterministic address.
     * @param bytecode The contract's creation code (bytecode + constructor args).
     * @return addr The address of the deployed contract.
     */
    function deploy(bytes32 salt, bytes memory bytecode) external payable returns (address addr) {
        require(bytecode.length > 0, "Bytecode cannot be empty");

        assembly {
            // create2(value, offset, size, salt)
            // add(bytecode, 0x20) points to the actual data (skipping the length prefix)
            // mload(bytecode) gets the length of the bytecode array
            addr := create2(
                callvalue(),
                add(bytecode, 0x20),
                mload(bytecode),
                salt
            )
        }

        require(addr != address(0), "CREATE2 deployment failed");
    }
}