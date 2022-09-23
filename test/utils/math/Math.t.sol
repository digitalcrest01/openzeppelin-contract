// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "forge-std/Test.sol";

import "../../../contracts/utils/math/Math.sol";
import "../../../contracts/utils/math/SafeMath.sol";

contract MathTest is Test {
    // CEILDIV
    function testCeilDiv(uint256 a, uint256 b) public {
        vm.assume(b > 0);

        uint256 result = Math.ceilDiv(a, b);

        if (result == 0) {
            assertEq(a, 0);
        } else {
            uint256 maxdiv = UINT256_MAX / b;
            bool overflow = maxdiv * b < a;
            assertTrue(a > b * (result - 1));
            assertTrue(overflow ? result == maxdiv + 1 : a <= b * result);
        }
    }

    // SQRT
    function testSqrt(uint256 input, uint8 r) public {
        Math.Rounding rounding = _asRounding(r);

        uint256 result = Math.sqrt(input, rounding);

        // square of result is bigger than input
        if (_squareBigger(result, input)) {
            assertTrue(rounding == Math.Rounding.Up);
            assertTrue(_squareSmaller(result - 1, input));
        }
        // square of result is smaller than input
        else if (_squareSmaller(result, input)) {
            assertFalse(rounding == Math.Rounding.Up);
            assertTrue(_squareBigger(result + 1, input));
        }
    }

    function _squareBigger(uint256 value, uint256 ref) private pure returns (bool) {
        (bool noOverflow, uint256 square) = SafeMath.tryMul(value, value);
        return !noOverflow || square > ref;
    }

    function _squareSmaller(uint256 value, uint256 ref) private pure returns (bool) {
        return value * value < ref;
    }

    // LOG2
    function testLog2(uint256 input, uint8 r) public {
        Math.Rounding rounding = _asRounding(r);

        uint256 result = Math.log2(input, rounding);

        if (input == 0) {
            assertEq(result, 0);
        } else if (_powerOf2Bigger(result, input)) {
            assertTrue(rounding == Math.Rounding.Up);
            assertTrue(_powerOf2Smaller(result - 1, input));
        } else if (_powerOf2Smaller(result, input)) {
            assertFalse(rounding == Math.Rounding.Up);
            assertTrue(_powerOf2Bigger(result + 1, input));
        }
    }

    function _powerOf2Bigger(uint256 value, uint256 ref) private pure returns (bool) {
        return value >= 256 || 2**value > ref; // 2**256 overflows uint256
    }

    function _powerOf2Smaller(uint256 value, uint256 ref) private pure returns (bool) {
        return 2**value < ref;
    }

    // LOG10
    function testLog10(uint256 input, uint8 r) public {
        Math.Rounding rounding = _asRounding(r);

        uint256 result = Math.log10(input, rounding);

        if (input == 0) {
            assertEq(result, 0);
        } else if (_powerOf10Bigger(result, input)) {
            assertTrue(rounding == Math.Rounding.Up);
            assertTrue(_powerOf10Smaller(result - 1, input));
        } else if (_powerOf10Smaller(result, input)) {
            assertFalse(rounding == Math.Rounding.Up);
            assertTrue(_powerOf10Bigger(result + 1, input));
        }
    }

    function _powerOf10Bigger(uint256 value, uint256 ref) private pure returns (bool) {
        return value >= 78 || 10**value > ref; // 10**78 overflows uint256
    }

    function _powerOf10Smaller(uint256 value, uint256 ref) private pure returns (bool) {
        return 10**value < ref;
    }

    // LOG256
    function testLog256(uint256 input, uint8 r) public {
        Math.Rounding rounding = _asRounding(r);

        uint256 result = Math.log256(input, rounding);

        if (input == 0) {
            assertEq(result, 0);
        } else if (_powerOf256Bigger(result, input)) {
            assertTrue(rounding == Math.Rounding.Up);
            assertTrue(_powerOf256Smaller(result - 1, input));
        } else if (_powerOf256Smaller(result, input)) {
            assertFalse(rounding == Math.Rounding.Up);
            assertTrue(_powerOf256Bigger(result + 1, input));
        }
    }

    function _powerOf256Bigger(uint256 value, uint256 ref) private pure returns (bool) {
        return value >= 32 || 256**value > ref; // 256**32 overflows uint256
    }

    function _powerOf256Smaller(uint256 value, uint256 ref) private pure returns (bool) {
        return 256**value < ref;
    }

    // MULDIV
    function testMulDiv(
        uint256 x,
        uint256 y,
        uint256 d
    ) public {
        vm.assume(d != 0);

        // This catching all overflow
        vm.assume(y == 0 || x / d <= UINT256_MAX / y);
        vm.assume(x == 0 || y / d <= UINT256_MAX / x);

        uint256 q = Math.mulDiv(x, y, d);

        // Full precision for q * d
        (uint256 qdHi, uint256 qdLo) = _mulHighLow(q, d);
        // Add reminder of x * y / d (computed as rem = (x * y % d))
        (uint256 qdRemLo, uint256 c) = _addCarry(qdLo, _mulmod(x, y, d));
        uint256 qdRemHi = qdHi + c;

        // Full precision for x * y
        (uint256 xyHi, uint256 xyLo) = _mulHighLow(x, y);

        // Full precision check that x * y = q * d + rem
        assertEq(xyHi, qdRemHi);
        assertEq(xyLo, qdRemLo);
    }

    function testMulDivDomain(
        uint256 x,
        uint256 y,
        uint256 d
    ) public {
        // violate one of the {testMulDiv} assumptions
        vm.assume(d == 0 || (y > 0 && x / d > UINT256_MAX / y) || (x > 0 && y / d > UINT256_MAX / x));

        // we are outside the scope of {testMulDiv}, we expect muldiv to revert
        try this.muldiv(x, y, d) returns (uint256) {
            assertTrue(false);
        } catch {
            assertTrue(true);
        }
    }

    // External call
    function muldiv(
        uint256 x,
        uint256 y,
        uint256 d
    ) external pure returns (uint256) {
        return Math.mulDiv(x, y, d);
    }

    // Helpers
    function _asRounding(uint8 r) private returns (Math.Rounding) {
        vm.assume(r < uint8(type(Math.Rounding).max));
        return Math.Rounding(r);
    }

    function _mulmod(
        uint256 a,
        uint256 b,
        uint256 c
    ) private pure returns (uint256 r) {
        assembly {
            r := mulmod(a, b, c)
        }
    }

    // https://stackoverflow.com/a/28904636/667959
    function _mulHighLow(uint256 a, uint256 b) private pure returns (uint256 high, uint256 low) {
        uint256 aLo = uint128(a);
        uint256 aHi = a >> 128;
        uint256 bLo = uint128(b);
        uint256 bHi = b >> 128;

        uint256 abHi = aHi * bHi;
        uint256 abMid = aHi * bLo;
        uint256 baMid = bHi * aLo;
        uint256 abLo = aLo * bLo;

        uint256 carry = (uint256(uint128(abMid)) + uint256(uint128(baMid)) + (abLo >> 128)) >> 128;

        high = abHi + (abMid >> 128) + (baMid >> 128) + carry;

        unchecked {
            low = a * b;
        }
    }

    function _addCarry(uint256 a, uint256 b) private pure returns (uint256 res, uint256 carry) {
        unchecked {
            res = a + b;
        }
        carry = res < a ? 1 : 0;
    }
}
