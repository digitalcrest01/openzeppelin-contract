// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../utils/structs/Vector.sol";

// Bytes32Vector
contract Bytes32VectorMock {
    using Vector for Vector.Bytes32Vector;

    event OperationResult(bytes32 value);

    Vector.Bytes32Vector private _vector;

    function pushBack(bytes32 value) public {
        _vector.pushBack(value);
    }

    function pushFront(bytes32 value) public {
        _vector.pushFront(value);
    }

    function popFront() public returns (bytes32) {
        bytes32 value = _vector.popFront();
        emit OperationResult(value);
        return value;
    }

    function popBack() public returns (bytes32) {
        bytes32 value = _vector.popBack();
        emit OperationResult(value);
        return value;
    }

    function front() public view returns (bytes32) {
        return _vector.front();
    }

    function back() public view returns (bytes32) {
        return _vector.back();
    }

    function at(uint256 i) public view returns (bytes32) {
        return _vector.at(i);
    }

    function clear() public {
        _vector.clear();
    }

    function length() public view returns (uint256) {
        return _vector.length();
    }

    function empty() public view returns (bool) {
        return _vector.empty();
    }
}
