// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";

interface IUserWallet {
    function initialize(address _owner) external;
    function execute(
        address to,
        uint256 value,
        bytes calldata data,
        uint256 providedNonce,
        bytes calldata signature
    ) external payable;
}

contract Factory {
    using Clones for address;

    address public immutable implementation;

    constructor(address _implementation) {
        implementation = _implementation;
    }

    function deployAndExecute(
        bytes32 salt,
        address owner,
        address to,
        uint256 value,
        bytes calldata data,
        uint256 providedNonce,
        bytes calldata signature
    ) external payable returns (address wallet) {
        wallet = implementation.cloneDeterministic(salt);

        IUserWallet(wallet).initialize(owner);

        IUserWallet(wallet).execute{value: msg.value}(
            to,
            value,
            data,
            providedNonce,
            signature
        );
    }
}