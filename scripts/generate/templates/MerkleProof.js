const format = require('../format-lines');
const { OPTS } = require('./MerkleProof.opts');

const DEFAULT_HASH = 'Hashes.commutativeKeccak256';

const formatArgsSingleLine = (...args) => args.filter(Boolean).join(', ');
const formatArgsMultiline = (...args) => '\n' + format(args.filter(Boolean).join(',\0').split('\0'));

// TEMPLATE
const header = `\
pragma solidity ^0.8.20;

import {Hashes} from "./Hashes.sol";

/**
 * @dev These functions deal with verification of Merkle Tree proofs.
 *
 * The tree and the proofs can be generated using our
 * https://github.com/OpenZeppelin/merkle-tree[JavaScript library].
 * You will find a quickstart guide in the readme.
 *
 * WARNING: You should avoid using leaf values that are 64 bytes long prior to
 * hashing, or use a hash function other than keccak256 for hashing leaves.
 * This is because the concatenation of a sorted pair of internal nodes in
 * the Merkle tree could be reinterpreted as a leaf value.
 * OpenZeppelin's JavaScript library generates Merkle trees that are safe
 * against this attack out of the box.
 *
 * IMPORTANT: Consider memory side-effects when using custom hashing functions
 * that access memory in an unsafe way.
 * 
 * NOTE: This library supports proof verification for merkle trees built using
 * custom _commutative_ hashing functions (i.e. \`H(a, b) == H(b, a)\`). Proving
 * leaf inclusion in trees built using non-commutative hashing functions requires
 * additional logic that is not supported by this library.
 */
`;

const errors = `\
/**
 *@dev The multiproof provided is not valid.
 */
error MerkleProofInvalidMultiproof();
`;

/* eslint-disable max-len */
const templateProof = ({ suffix, location, visibility, hash }) => `\
/**
 * @dev Returns true if a \`leaf\` can be proved to be a part of a Merkle tree
 * defined by \`root\`. For this, a \`proof\` must be provided, containing
 * sibling hashes on the branch from the leaf to the root of the tree. Each
 * pair of leaves and each pair of pre-images are assumed to be sorted.
 *
 * This version handles proofs in ${location} with ${hash ? 'a custom' : 'the default'} hashing function.
 */
function verify${suffix}(${(hash ? formatArgsMultiline : formatArgsSingleLine)(
  `bytes32[] ${location} proof`,
  'bytes32 root',
  'bytes32 leaf',
  hash && `function(bytes32, bytes32) view returns (bytes32) ${hash}`,
)}) internal ${visibility} returns (bool) {
    return processProof${suffix}(proof, leaf${hash ? `, ${hash}` : ''}) == root;
}

/**
 * @dev Returns the rebuilt hash obtained by traversing a Merkle tree up
 * from \`leaf\` using \`proof\`. A \`proof\` is valid if and only if the rebuilt
 * hash matches the root of the tree. When processing the proof, the pairs
 * of leafs & pre-images are assumed to be sorted.
 *
 * This version handles proofs in ${location} with ${hash ? 'a custom' : 'the default'} hashing function.
 */
function processProof${suffix}(${(hash ? formatArgsMultiline : formatArgsSingleLine)(
  `bytes32[] ${location} proof`,
  'bytes32 leaf',
  hash && `function(bytes32, bytes32) view returns (bytes32) ${hash}`,
)}) internal ${visibility} returns (bytes32) {
    bytes32 computedHash = leaf;
    for (uint256 i = 0; i < proof.length; i++) {
        computedHash = ${hash ?? DEFAULT_HASH}(computedHash, proof[i]);
    }
    return computedHash;
}
`;

const templateMultiProof = ({ suffix, location, visibility, hash }) => `\
/**
 * @dev Returns true if the \`leaves\` can be simultaneously proven to be a part of a Merkle tree defined by
 * \`root\`, according to \`proof\` and \`proofFlags\` as described in {processMultiProof}.
 *
 * This version handles multiproofs in ${location} with ${hash ? 'a custom' : 'the default'} hashing function.
 *
 * CAUTION: Not all Merkle trees admit multiproofs. See {processMultiProof} for details.
 *
 * NOTE: Consider the case where \`root == proof[0] && leaves.length == 0\` as it will return \`true\`.
 * The \`leaves\` must be validated independently. See {processMultiProof${suffix}}.
 */
function multiProofVerify${suffix}(${formatArgsMultiline(
  `bytes32[] ${location} proof`,
  `bool[] ${location} proofFlags`,
  'bytes32 root',
  `bytes32[] memory leaves`,
  hash && `function(bytes32, bytes32) view returns (bytes32) ${hash}`,
)}) internal ${visibility} returns (bool) {
    return processMultiProof${suffix}(proof, proofFlags, leaves${hash ? `, ${hash}` : ''}) == root;
}

/**
 * @dev Returns the root of a tree reconstructed from \`leaves\` and sibling nodes in \`proof\`. The reconstruction
 * proceeds by incrementally reconstructing all inner nodes by combining a leaf/inner node with either another
 * leaf/inner node or a proof sibling node, depending on whether each \`proofFlags\` item is true or false
 * respectively.
 *
 * This version handles multiproofs in ${location} with ${hash ? 'a custom' : 'the default'} hashing function.
 *
 * CAUTION: Not all Merkle trees admit multiproofs. To use multiproofs, it is sufficient to ensure that: 1) the tree
 * is complete (but not necessarily perfect), 2) the leaves to be proven are in the opposite order they are in the
 * tree (i.e., as seen from right to left starting at the deepest layer and continuing at the next layer).
 *
 * NOTE: The _empty set_ (i.e. the case where \`proof.length == 1 && leaves.length == 0\`) is considered a no-op,
 * and therefore a valid multiproof (i.e. it returns \`proof[0]\`). Consider disallowing this case if you're not
 * validating the leaves elsewhere.
 */
function processMultiProof${suffix}(${formatArgsMultiline(
  `bytes32[] ${location} proof`,
  `bool[] ${location} proofFlags`,
  `bytes32[] memory leaves`,
  hash && `function(bytes32, bytes32) view returns (bytes32) ${hash}`,
)}) internal ${visibility} returns (bytes32 merkleRoot) {
    // This function rebuilds the root hash by traversing the tree up from the leaves. The root is rebuilt by
    // consuming and producing values on a queue. The queue starts with the \`leaves\` array, then goes onto the
    // \`hashes\` array. At the end of the process, the last hash in the \`hashes\` array should contain the root of
    // the Merkle tree.
    uint256 leavesLen = leaves.length;
    uint256 proofFlagsLen = proofFlags.length;

    // Check proof validity.
    if (leavesLen + proof.length != proofFlagsLen + 1) {
        revert MerkleProofInvalidMultiproof();
    }

    // The xxxPos values are "pointers" to the next value to consume in each array. All accesses are done using
    // \`xxx[xxxPos++]\`, which return the current value and increment the pointer, thus mimicking a queue's "pop".
    bytes32[] memory hashes = new bytes32[](proofFlagsLen);
    uint256 leafPos = 0;
    uint256 hashPos = 0;
    uint256 proofPos = 0;
    // At each step, we compute the next hash using two values:
    // - a value from the "main queue". If not all leaves have been consumed, we get the next leaf, otherwise we
    //   get the next hash.
    // - depending on the flag, either another value from the "main queue" (merging branches) or an element from the
    //   \`proof\` array.
    for (uint256 i = 0; i < proofFlagsLen; i++) {
        bytes32 a = leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++];
        bytes32 b = proofFlags[i]
            ? (leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++])
            : proof[proofPos++];
        hashes[i] = ${hash ?? DEFAULT_HASH}(a, b);
    }

    if (proofFlagsLen > 0) {
        if (proofPos != proof.length) {
            revert MerkleProofInvalidMultiproof();
        }
        unchecked {
            return hashes[proofFlagsLen - 1];
        }
    } else if (leavesLen > 0) {
        return leaves[0];
    } else {
        return proof[0];
    }
}
`;
/* eslint-enable max-len */

// GENERATE
module.exports = format(
  header.trimEnd(),
  'library MerkleProof {',
  format(
    [].concat(
      errors,
      OPTS.flatMap(opts => templateProof(opts)),
      OPTS.flatMap(opts => templateMultiProof(opts)),
    ),
  ).trimEnd(),
  '}',
);
