// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Math} from "../math/Math.sol";

/**
 * @dev RSA PKCS#1 v1.5 signature verification implementation according to https://datatracker.ietf.org/doc/html/rfc8017[RFC8017].
 *
 * This library supports PKCS#1 v1.5 padding to avoid malleability via chosen plaintext attacks in practical implementations.
 * The padding follows the EMSA-PKCS1-v1_5-ENCODE encoding definition as per section 9.2 of the RFC. This padding makes
 * RSA semanticaly secure for signing messages.
 *
 * Inspired by https://github.com/adria0/SolRsaVerify[Adrià Massanet's work]
 */
library RSA {
    /**
     * @dev Same as {pkcs1} but using SHA256 to calculate the digest of `data`.
     */
    function pkcs1Sha256(
        bytes memory data,
        bytes memory s,
        bytes memory e,
        bytes memory n
    ) internal view returns (bool) {
        return pkcs1Sha256(sha256(data), s, e, n);
    }

    /**
     * @dev Verifies a PKCSv1.5 signature given a digest according the verification
     * method described in https://datatracker.ietf.org/doc/html/rfc8017#section-8.2.2[section 8.2.2 of RFC8017].
     *
     * IMPORTANT: Although this function allows for it, using n of length 1024 bits is considered unsafe.
     * Consider using at least 2048 bits.
     *
     * @param digest the digest to verify
     * @param s is a buffer containing the signature
     * @param e is the exponent of the public key
     * @param n is the modulus of the public key
     */
    function pkcs1(bytes32 digest, bytes memory s, bytes memory e, bytes memory n) internal view returns (bool) {
        unchecked {
            // cache and check length
            uint256 length = n.length;
            if (
                length < 0x40 || // PKCS#1 padding is slightly less than 0x40 bytes at the bare minimum
                length != s.length // signature must have the same length as the finite field
            ) {
                return false;
            }

            // RSAVP1 https://datatracker.ietf.org/doc/html/rfc8017#section-5.2.2
            (bool success, bytes memory buffer) = Math.tryModExp(s, e, n);
            if (!success) {
                return false;
            }

            // Check that buffer is well encoded:
            // buffer ::= 0x00 | 0x01 | PS | 0x00 | DigestInfo
            //
            // With
            // - PS is padding filled with 0xFF
            // - DigestInfo ::= SEQUENCE {
            //    digestAlgorithm AlgorithmIdentifier,
            //      [optional algorithm parameters]
            //    digest OCTET STRING
            // }

            // Get AlgorithmIdentifier from the DigestInfo, and set the config accordingly
            // - params: includes 00 + first part of DigestInfo
            // - mask: filter to check the params
            // - offset: length of the suffix (including digest)
            bytes32 params;
            bytes32 mask;
            uint256 offset;
            if (_unsafeReadBytes1(buffer, length - 50) == 0x31) {
                // case: sha256Explicit
                offset = 0x34;
                params = 0x003031300d060960864801650304020105000420000000000000000000000000;
                mask = 0xffffffffffffffffffffffffffffffffffffffff000000000000000000000000;
            } else if (_unsafeReadBytes1(buffer, length - 48) == 0x2F) {
                // case: sha256Implicit
                offset = 0x32;
                params = 0x00302f300b060960864801650304020104200000000000000000000000000000;
                mask = 0xffffffffffffffffffffffffffffffffffff0000000000000000000000000000;
            } else {
                // unknown
                return false;
            }

            // Length is at least 0x40 and offset is at most 0x34, so this is safe. There is always some padding.
            uint256 paddingEnd = length - offset;

            // The padding has variable (arbitrary) length, so we check it byte per byte in a loop.
            // This is required to ensure non-malleability. Not checking would allow an attacker to
            // use the padding to manipulate the message in order to create a valid signature out of
            // multiple valid signatures.
            for (uint256 i = 2; i < paddingEnd; ++i) {
                if (_unsafeReadBytes1(buffer, i) != 0xFF) {
                    return false;
                }
            }

            // All the other parameters are small enough to fit in a bytes32, so we can check them directly.
            return
                bytes2(0x0001) == _unsafeReadBytes2(buffer, 0x00) && // 00 | 01
                // PS was checked in the loop
                params == _unsafeReadBytes32(buffer, paddingEnd) & mask && // DigestInfo
                // Optional parameters are not checked
                digest == _unsafeReadBytes32(buffer, length - 0x20); // Digest
        }
    }

    function _unsafeReadBytes32(bytes memory array, uint256 offset) private pure returns (bytes32 result) {
        assembly {
            result := mload(add(add(array, 0x20), offset))
        }
    }

    function _unsafeReadBytes1(bytes memory array, uint256 offset) private pure returns (bytes1) {
        return bytes1(_unsafeReadBytes32(array, offset));
    }

    function _unsafeReadBytes2(bytes memory array, uint256 offset) private pure returns (bytes2) {
        return bytes2(_unsafeReadBytes32(array, offset));
    }
}
