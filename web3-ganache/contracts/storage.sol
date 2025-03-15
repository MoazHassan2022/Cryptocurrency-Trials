// contracts/SimpleStorage.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

contract Storage {
    uint256 public value;

    constructor(uint256 _initialValue) {
        value = _initialValue;
    }

    function set(uint256 _value) public {
        value = _value;
    }

    function get() public view returns (uint256) {
        return value;
    }
}
