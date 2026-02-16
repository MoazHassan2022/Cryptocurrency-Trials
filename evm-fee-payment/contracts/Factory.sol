// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IUserWallet {
    function execute(
        address to,
        uint256 value,
        bytes calldata data,
        bytes calldata signature
    ) external;
}

contract Factory {

    function deployAndExecute(
        bytes32 salt,
        bytes memory initCode,
        address to,
        uint256 value,
        bytes calldata data,
        bytes calldata signature
    ) external payable returns (address wallet) {

        assembly {
            wallet := create2(0, add(initCode, 0x20), mload(initCode), salt)
            if iszero(extcodesize(wallet)) { revert(0, 0) }
        }

        IUserWallet(wallet).execute(to, value, data, signature);
    }
}
