/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/solana_programs.json`.
 */
export type SolanaPrograms = {
  "address": "DMiW8pL1vuaRSG367zDRRkSmQM8z5kKUGU3eC9t7AFDT",
  "metadata": {
    "name": "solanaPrograms",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "airdrop",
      "docs": [
        "Airdrop tokens to a vault without proof verification"
      ],
      "discriminator": [
        113,
        173,
        36,
        238,
        38,
        152,
        22,
        117
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "ledger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "utxo",
          "docs": [
            "New UTXO account to be created",
            "Uses same UTXO_SEED as regular UTXOs - differentiated by optional voting fields"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  116,
                  120,
                  111
                ]
              },
              {
                "kind": "arg",
                "path": "utxoHash"
              }
            ]
          }
        },
        {
          "name": "loader",
          "docs": [
            "Loader account containing Kyber ciphertext (will be closed after use)"
          ],
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "utxoHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "encryptedPayload",
          "type": "bytes"
        },
        {
          "name": "nonce",
          "type": {
            "array": [
              "u8",
              12
            ]
          }
        },
        {
          "name": "ciphertextCommitment",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "epoch",
          "type": "u32"
        }
      ]
    },
    {
      "name": "completeVault",
      "docs": [
        "Complete vault with second part of Kyber public key"
      ],
      "discriminator": [
        13,
        122,
        144,
        244,
        184,
        172,
        57,
        146
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "kyberKeyPart2",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "createUtxo",
      "discriminator": [
        248,
        248,
        178,
        96,
        127,
        36,
        22,
        226
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "ledger",
          "docs": [
            "Ledger account to verify previous UTXO hash"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "utxo",
          "docs": [
            "New UTXO account to be created",
            "PDA: [\"utxo\", utxo_hash]"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  116,
                  120,
                  111
                ]
              },
              {
                "kind": "arg",
                "path": "utxoHash"
              }
            ]
          }
        },
        {
          "name": "loader",
          "docs": [
            "Loader account containing Kyber ciphertext (will be closed after use)"
          ],
          "writable": true
        },
        {
          "name": "zkProof",
          "docs": [
            "ZK Proof account reference"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "utxoHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "encryptedPayload",
          "type": "bytes"
        },
        {
          "name": "nonce",
          "type": {
            "array": [
              "u8",
              12
            ]
          }
        },
        {
          "name": "ciphertextCommitment",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "epoch",
          "type": "u32"
        }
      ]
    },
    {
      "name": "deactivateProver",
      "docs": [
        "Deactivate a prover (admin only)"
      ],
      "discriminator": [
        37,
        2,
        71,
        79,
        48,
        237,
        121,
        28
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "programConfig",
          "docs": [
            "Program configuration"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "proverRegistry",
          "docs": [
            "Prover registry"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  118,
                  101,
                  114,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "proverPubkey",
          "docs": [
            "Prover's public key to deactivate"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "initLedger",
      "docs": [
        "Initialize the ledger"
      ],
      "discriminator": [
        91,
        194,
        32,
        83,
        92,
        206,
        54,
        67
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "ledger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initLoader",
      "discriminator": [
        216,
        113,
        137,
        7,
        85,
        181,
        168,
        223
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "loader",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initProgram",
      "docs": [
        "Initialize the program with admin authority"
      ],
      "discriminator": [
        56,
        120,
        211,
        99,
        196,
        190,
        129,
        187
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "programConfig",
          "docs": [
            "Program configuration account"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "proverRegistry",
          "docs": [
            "Prover registry account"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  118,
                  101,
                  114,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initVault",
      "docs": [
        "Initialize vault with first part of Kyber public key"
      ],
      "discriminator": [
        77,
        79,
        85,
        150,
        33,
        217,
        52,
        106
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "keyHash"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "keyHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "kyberKeyPart1",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "initZkProof",
      "docs": [
        "Initialize ZK proof account"
      ],
      "discriminator": [
        107,
        215,
        148,
        146,
        233,
        68,
        113,
        229
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "zkProof",
          "docs": [
            "We just initialize the data structure here."
          ],
          "writable": true
        }
      ],
      "args": [
        {
          "name": "totalBytes",
          "type": "u32"
        }
      ]
    },
    {
      "name": "registerProver",
      "docs": [
        "Register a new prover (admin only)"
      ],
      "discriminator": [
        170,
        190,
        182,
        150,
        76,
        46,
        227,
        208
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "programConfig",
          "docs": [
            "Program configuration"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "proverRegistry",
          "docs": [
            "Prover registry"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  118,
                  101,
                  114,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "proverPubkey",
          "docs": [
            "Prover's public key to register"
          ]
        }
      ],
      "args": [
        {
          "name": "uniqueId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "submitAttestation",
      "docs": [
        "Submit attestation vote on a UTXO"
      ],
      "discriminator": [
        238,
        220,
        255,
        105,
        183,
        211,
        40,
        83
      ],
      "accounts": [
        {
          "name": "proverOld",
          "docs": [
            "The old prover account that will be used to pay for this IX.",
            "Afterwards, all the remaining lamports will be transferred to the new prover account."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "prover",
          "docs": [
            "The new prover submitting their vote",
            "Their public key will be hashed and checked against the registry",
            "This becomes the active prover account after key rotation"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "ledger",
          "docs": [
            "Ledger to verify and update"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "utxo",
          "docs": [
            "UTXO being attested"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  116,
                  120,
                  111
                ]
              },
              {
                "kind": "arg",
                "path": "utxoHash"
              }
            ]
          }
        },
        {
          "name": "proverRegistry",
          "docs": [
            "Prover registry"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  118,
                  101,
                  114,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "utxoHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "vote",
          "type": "bool"
        },
        {
          "name": "nextKeyHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "writeLoader",
      "docs": [
        "Write chunk to loader"
      ],
      "discriminator": [
        50,
        101,
        230,
        10,
        73,
        217,
        42,
        209
      ],
      "accounts": [
        {
          "name": "loader",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "offset",
          "type": "u32"
        },
        {
          "name": "data",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "writeZkProof",
      "docs": [
        "Write chunk to ZK proof"
      ],
      "discriminator": [
        158,
        236,
        115,
        161,
        164,
        17,
        46,
        22
      ],
      "accounts": [
        {
          "name": "zkProof",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "offset",
          "type": "u32"
        },
        {
          "name": "chunk",
          "type": "bytes"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "ledger",
      "discriminator": [
        43,
        41,
        21,
        213,
        180,
        176,
        95,
        32
      ]
    },
    {
      "name": "loader",
      "discriminator": [
        107,
        205,
        249,
        225,
        119,
        75,
        83,
        248
      ]
    },
    {
      "name": "programConfig",
      "discriminator": [
        196,
        210,
        90,
        231,
        144,
        149,
        140,
        63
      ]
    },
    {
      "name": "proverRegistry",
      "discriminator": [
        210,
        201,
        111,
        119,
        245,
        85,
        163,
        11
      ]
    },
    {
      "name": "utxo",
      "discriminator": [
        210,
        200,
        228,
        232,
        85,
        104,
        216,
        76
      ]
    },
    {
      "name": "vault",
      "discriminator": [
        211,
        8,
        232,
        43,
        2,
        152,
        117,
        119
      ]
    }
  ],
  "events": [
    {
      "name": "airdropCompleted",
      "discriminator": [
        191,
        220,
        138,
        226,
        189,
        53,
        3,
        235
      ]
    },
    {
      "name": "attestationSubmitted",
      "discriminator": [
        177,
        213,
        117,
        225,
        166,
        11,
        54,
        218
      ]
    },
    {
      "name": "ledgerInitialized",
      "discriminator": [
        56,
        38,
        185,
        200,
        94,
        92,
        181,
        202
      ]
    },
    {
      "name": "loaderChunkWritten",
      "discriminator": [
        100,
        107,
        219,
        86,
        6,
        9,
        103,
        244
      ]
    },
    {
      "name": "loaderInitialized",
      "discriminator": [
        232,
        178,
        234,
        13,
        122,
        253,
        41,
        114
      ]
    },
    {
      "name": "programInitialized",
      "discriminator": [
        43,
        70,
        110,
        241,
        199,
        218,
        221,
        245
      ]
    },
    {
      "name": "proverDeactivated",
      "discriminator": [
        124,
        129,
        96,
        166,
        67,
        234,
        34,
        181
      ]
    },
    {
      "name": "proverRegistered",
      "discriminator": [
        243,
        150,
        169,
        237,
        21,
        205,
        121,
        191
      ]
    },
    {
      "name": "utxoCreated",
      "discriminator": [
        141,
        33,
        36,
        147,
        147,
        155,
        87,
        98
      ]
    },
    {
      "name": "vaultCompleted",
      "discriminator": [
        174,
        72,
        181,
        184,
        121,
        48,
        107,
        227
      ]
    },
    {
      "name": "vaultInitialized",
      "discriminator": [
        180,
        43,
        207,
        2,
        18,
        71,
        3,
        75
      ]
    },
    {
      "name": "zkProofChunkWritten",
      "discriminator": [
        86,
        99,
        62,
        54,
        246,
        173,
        54,
        146
      ]
    },
    {
      "name": "zkProofInitialized",
      "discriminator": [
        41,
        89,
        183,
        101,
        104,
        233,
        152,
        10
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidKeyLength",
      "msg": "Kyber Public key must be exactly 1184 bytes long"
    },
    {
      "code": 6001,
      "name": "chunkSizeExceeded",
      "msg": "Chunk size exceeds maximum allowed length of 800 bytes"
    },
    {
      "code": 6002,
      "name": "hashMismatch",
      "msg": "Hash Mismatch: Provided key does not match the expected hash"
    },
    {
      "code": 6003,
      "name": "invalidPreviousUtxoHash",
      "msg": "Invalid previous UTXO hash provided"
    },
    {
      "code": 6004,
      "name": "payloadTooLarge",
      "msg": "Payload too large"
    },
    {
      "code": 6005,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow occurred"
    },
    {
      "code": 6006,
      "name": "invalidOffset",
      "msg": "Invalid offset: must match current bytes_written"
    },
    {
      "code": 6007,
      "name": "programConfigAlreadyInitialized",
      "msg": "Program config already initialized"
    },
    {
      "code": 6008,
      "name": "adminAuthorityNotSet",
      "msg": "Admin authority not set"
    },
    {
      "code": 6009,
      "name": "unauthorizedAdmin",
      "msg": "Unauthorized: Only admin can perform this action"
    },
    {
      "code": 6010,
      "name": "proverAlreadyRegistered",
      "msg": "Prover already registered"
    },
    {
      "code": 6011,
      "name": "proverNotRegistered",
      "msg": "Prover not registered"
    },
    {
      "code": 6012,
      "name": "proverNotActive",
      "msg": "Prover not active"
    },
    {
      "code": 6013,
      "name": "proverAlreadyVoted",
      "msg": "Prover already voted on this UTXO"
    },
    {
      "code": 6014,
      "name": "maxProversReached",
      "msg": "Maximum provers reached"
    },
    {
      "code": 6015,
      "name": "maxVotesReached",
      "msg": "Maximum votes reached for this UTXO"
    },
    {
      "code": 6016,
      "name": "invalidStakeAmount",
      "msg": "Invalid stake amount"
    },
    {
      "code": 6017,
      "name": "proverUniqueIdAlreadyUsed",
      "msg": "Prover unique ID already used"
    },
    {
      "code": 6018,
      "name": "invalidProverUniqueId",
      "msg": "Invalid prover unique ID. Cannot be zero."
    },
    {
      "code": 6019,
      "name": "zkProofAccountNotProvided",
      "msg": "ZK Proof account not provided"
    },
    {
      "code": 6020,
      "name": "utxoHashMismatch",
      "msg": "UTXO hash mismatch with ledger"
    },
    {
      "code": 6021,
      "name": "minAttestationsNotMet",
      "msg": "Min attestations not met"
    }
  ],
  "types": [
    {
      "name": "airdropCompleted",
      "docs": [
        "Event emitted when an airdrop is completed"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "utxo",
            "docs": [
              "UTXO account PDA"
            ],
            "type": "pubkey"
          },
          {
            "name": "utxoHash",
            "docs": [
              "UTXO hash"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "prevUtxoHash",
            "docs": [
              "Previous UTXO hash"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "epoch",
            "docs": [
              "Epoch number"
            ],
            "type": "u32"
          },
          {
            "name": "payloadSize",
            "docs": [
              "Encrypted payload size"
            ],
            "type": "u32"
          },
          {
            "name": "ciphertextCommitment",
            "docs": [
              "Ciphertext commitment"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "bump",
            "docs": [
              "UTXO PDA bump"
            ],
            "type": "u8"
          },
          {
            "name": "newLedgerCount",
            "docs": [
              "New ledger count after airdrop"
            ],
            "type": "u64"
          },
          {
            "name": "timestamp",
            "docs": [
              "Timestamp when created"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "attestationSubmitted",
      "docs": [
        "Event emitted when an attestation is submitted"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "utxo",
            "docs": [
              "The UTXO being voted on"
            ],
            "type": "pubkey"
          },
          {
            "name": "utxoHash",
            "docs": [
              "UTXO hash"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "proverOld",
            "docs": [
              "Old prover's public key (before rotation)"
            ],
            "type": "pubkey"
          },
          {
            "name": "proverOldHash",
            "docs": [
              "Old prover's hash"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "proverNew",
            "docs": [
              "New prover's public key (after rotation)"
            ],
            "type": "pubkey"
          },
          {
            "name": "proverUniqueId",
            "docs": [
              "Prover's unique ID"
            ],
            "type": "u64"
          },
          {
            "name": "vote",
            "docs": [
              "The vote (true=valid, false=invalid)"
            ],
            "type": "bool"
          },
          {
            "name": "nextKeyHash",
            "docs": [
              "Hash of prover's next public key (for next rotation)"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "lamportsTransferred",
            "docs": [
              "Lamports transferred"
            ],
            "type": "u64"
          },
          {
            "name": "validVotes",
            "docs": [
              "Current count of valid votes"
            ],
            "type": "u16"
          },
          {
            "name": "invalidVotes",
            "docs": [
              "Current count of invalid votes"
            ],
            "type": "u16"
          },
          {
            "name": "totalVotes",
            "docs": [
              "Total votes received"
            ],
            "type": "u16"
          },
          {
            "name": "thresholdMet",
            "docs": [
              "Whether threshold was met"
            ],
            "type": "bool"
          },
          {
            "name": "newLedgerTip",
            "docs": [
              "New ledger tip hash (if threshold met)"
            ],
            "type": {
              "option": {
                "array": [
                  "u8",
                  32
                ]
              }
            }
          },
          {
            "name": "newLedgerCount",
            "docs": [
              "New ledger count (if threshold met)"
            ],
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "timestamp",
            "docs": [
              "Timestamp when submitted"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "ledger",
      "docs": [
        "Ledger account that tracks the last valid UTXO hash"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "count",
            "docs": [
              "Total number of valid UTXOs"
            ],
            "type": "u64"
          },
          {
            "name": "lastValidUtxoHash",
            "docs": [
              "Hash of the last valid UTXO (genesis is all zeros)"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for PDA"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "ledgerInitialized",
      "docs": [
        "Event emitted when the ledger is initialized"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "count",
            "docs": [
              "Initial count (should be 0)"
            ],
            "type": "u64"
          },
          {
            "name": "genesisHash",
            "docs": [
              "Genesis hash (all zeros)"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "bump",
            "docs": [
              "Ledger PDA bump"
            ],
            "type": "u8"
          },
          {
            "name": "timestamp",
            "docs": [
              "Timestamp when initialized"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "loader",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "ciphertext",
            "type": {
              "array": [
                "u8",
                1088
              ]
            }
          }
        ]
      }
    },
    {
      "name": "loaderChunkWritten",
      "docs": [
        "Event emitted when a chunk is written to the loader"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "loader",
            "docs": [
              "Loader account address"
            ],
            "type": "pubkey"
          },
          {
            "name": "chunkSize",
            "docs": [
              "Chunk size in bytes"
            ],
            "type": "u32"
          },
          {
            "name": "offset",
            "docs": [
              "Offset where chunk was written"
            ],
            "type": "u32"
          },
          {
            "name": "end",
            "docs": [
              "End position after write"
            ],
            "type": "u32"
          },
          {
            "name": "timestamp",
            "docs": [
              "Timestamp when written"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "loaderInitialized",
      "docs": [
        "Event emitted when a loader is initialized"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "loader",
            "docs": [
              "Loader account address"
            ],
            "type": "pubkey"
          },
          {
            "name": "size",
            "docs": [
              "Size of the loader account"
            ],
            "type": "u32"
          },
          {
            "name": "timestamp",
            "docs": [
              "Timestamp when initialized"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "programConfig",
      "docs": [
        "Program configuration account"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "adminAuthority",
            "docs": [
              "Admin authority who can manage provers"
            ],
            "type": "pubkey"
          },
          {
            "name": "minAttestations",
            "docs": [
              "Minimum attestations required for UTXO validity"
            ],
            "type": "u16"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for PDA"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "programInitialized",
      "docs": [
        "Event emitted when the program is initialized"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "docs": [
              "Admin authority who initialized the program"
            ],
            "type": "pubkey"
          },
          {
            "name": "minAttestations",
            "docs": [
              "Minimum attestations required for UTXO validity"
            ],
            "type": "u16"
          },
          {
            "name": "configBump",
            "docs": [
              "Program config PDA bump"
            ],
            "type": "u8"
          },
          {
            "name": "registryBump",
            "docs": [
              "Prover registry PDA bump"
            ],
            "type": "u8"
          },
          {
            "name": "timestamp",
            "docs": [
              "Timestamp when initialized"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "proverDeactivated",
      "docs": [
        "Event emitted when a prover is deactivated"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "docs": [
              "Admin who deactivated the prover"
            ],
            "type": "pubkey"
          },
          {
            "name": "proverPubkey",
            "docs": [
              "Prover's public key that was deactivated"
            ],
            "type": "pubkey"
          },
          {
            "name": "proverPubkeyHash",
            "docs": [
              "Hash of prover's public key"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "timestamp",
            "docs": [
              "Timestamp when deactivated"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "proverInfo",
      "docs": [
        "Information about a single prover"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "uniqueId",
            "docs": [
              "Unique identifier for the prover"
            ],
            "type": "u64"
          },
          {
            "name": "pubkeyHash",
            "docs": [
              "Hash of prover's current public key"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "isActive",
            "docs": [
              "Whether the prover is currently active"
            ],
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "proverRegistered",
      "docs": [
        "Event emitted when a new prover is registered"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "docs": [
              "Admin who registered the prover"
            ],
            "type": "pubkey"
          },
          {
            "name": "uniqueId",
            "docs": [
              "Unique identifier for the prover"
            ],
            "type": "u64"
          },
          {
            "name": "proverPubkey",
            "docs": [
              "Prover's public key"
            ],
            "type": "pubkey"
          },
          {
            "name": "proverPubkeyHash",
            "docs": [
              "Hash of prover's public key"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "totalProvers",
            "docs": [
              "Total number of provers after registration"
            ],
            "type": "u32"
          },
          {
            "name": "timestamp",
            "docs": [
              "Timestamp when registered"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "proverRegistry",
      "docs": [
        "Prover registry account"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proverCount",
            "docs": [
              "Number of registered provers"
            ],
            "type": "u32"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for PDA derivation"
            ],
            "type": "u8"
          },
          {
            "name": "provers",
            "docs": [
              "Array of prover information"
            ],
            "type": {
              "vec": {
                "defined": {
                  "name": "proverInfo"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "proverVote",
      "docs": [
        "Vote record for a prover on a UTXO"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proverId",
            "docs": [
              "Unique ID of the prover"
            ],
            "type": "u64"
          },
          {
            "name": "isValid",
            "docs": [
              "Vote value: true = valid, false = invalid"
            ],
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "utxo",
      "docs": [
        "UTXO account structure",
        "Used for both regular UTXOs (with voting) and airdrop UTXOs (without voting)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "epoch",
            "docs": [
              "Epoch number"
            ],
            "type": "u32"
          },
          {
            "name": "utxoHash",
            "docs": [
              "Hash of this UTXO"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "prevUtxoHash",
            "docs": [
              "Hash of previous UTXO"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "ciphertextCommitment",
            "docs": [
              "SHA256 commitment of ciphertext+payload+nonce"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "nonce",
            "docs": [
              "ChaCha20 nonce for decryption"
            ],
            "type": {
              "array": [
                "u8",
                12
              ]
            }
          },
          {
            "name": "encryptedPayload",
            "docs": [
              "Encrypted payload data"
            ],
            "type": "bytes"
          },
          {
            "name": "kyberCiphertext",
            "docs": [
              "Kyber ciphertext for shared secret"
            ],
            "type": {
              "array": [
                "u8",
                1088
              ]
            }
          },
          {
            "name": "zkProofPubkey",
            "docs": [
              "Reference to ZK proof account (None for airdrop UTXOs)"
            ],
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "votes",
            "docs": [
              "Map of prover votes (None for airdrop UTXOs - immediately finalized)"
            ],
            "type": {
              "option": {
                "array": [
                  {
                    "defined": {
                      "name": "proverVote"
                    }
                  },
                  10
                ]
              }
            }
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for PDA"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "utxoCreated",
      "docs": [
        "Event emitted when a UTXO is created"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "utxo",
            "docs": [
              "UTXO account PDA"
            ],
            "type": "pubkey"
          },
          {
            "name": "utxoHash",
            "docs": [
              "UTXO hash"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "prevUtxoHash",
            "docs": [
              "Previous UTXO hash"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "epoch",
            "docs": [
              "Epoch number"
            ],
            "type": "u32"
          },
          {
            "name": "payloadSize",
            "docs": [
              "Encrypted payload size"
            ],
            "type": "u32"
          },
          {
            "name": "zkProof",
            "docs": [
              "ZK proof reference"
            ],
            "type": "pubkey"
          },
          {
            "name": "ciphertextCommitment",
            "docs": [
              "Ciphertext commitment"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "bump",
            "docs": [
              "UTXO PDA bump"
            ],
            "type": "u8"
          },
          {
            "name": "timestamp",
            "docs": [
              "Timestamp when created"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "vault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "flags",
            "type": "u8"
          },
          {
            "name": "kyberPubkey",
            "type": "bytes"
          }
        ]
      }
    },
    {
      "name": "vaultCompleted",
      "docs": [
        "Event emitted when a vault is completed"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "docs": [
              "Vault PDA"
            ],
            "type": "pubkey"
          },
          {
            "name": "totalLength",
            "docs": [
              "Total length of the Kyber public key"
            ],
            "type": "u32"
          },
          {
            "name": "keyHash",
            "docs": [
              "Hash of the Kyber public key"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "timestamp",
            "docs": [
              "Timestamp when completed"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "vaultInitialized",
      "docs": [
        "Event emitted when a vault is initialized"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "Owner of the vault"
            ],
            "type": "pubkey"
          },
          {
            "name": "vault",
            "docs": [
              "Vault PDA"
            ],
            "type": "pubkey"
          },
          {
            "name": "version",
            "docs": [
              "Version of the vault"
            ],
            "type": "u8"
          },
          {
            "name": "chunk1Length",
            "docs": [
              "Length of the first chunk"
            ],
            "type": "u32"
          },
          {
            "name": "timestamp",
            "docs": [
              "Timestamp when initialized"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "zkProofChunkWritten",
      "docs": [
        "Event emitted when a chunk is written to the ZK proof"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "zkProof",
            "docs": [
              "ZK proof account address"
            ],
            "type": "pubkey"
          },
          {
            "name": "chunkSize",
            "docs": [
              "Chunk size in bytes"
            ],
            "type": "u32"
          },
          {
            "name": "offset",
            "docs": [
              "Offset where chunk was written"
            ],
            "type": "u32"
          },
          {
            "name": "newBytesWritten",
            "docs": [
              "New bytes written"
            ],
            "type": "u32"
          },
          {
            "name": "totalLength",
            "docs": [
              "Total length"
            ],
            "type": "u32"
          },
          {
            "name": "timestamp",
            "docs": [
              "Timestamp when written"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "zkProofInitialized",
      "docs": [
        "Event emitted when a ZK proof account is initialized"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "zkProof",
            "docs": [
              "ZK proof account address"
            ],
            "type": "pubkey"
          },
          {
            "name": "totalBytes",
            "docs": [
              "Total bytes allocated"
            ],
            "type": "u32"
          },
          {
            "name": "timestamp",
            "docs": [
              "Timestamp when initialized"
            ],
            "type": "i64"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "seed",
      "type": "string",
      "value": "\"anchor\""
    }
  ]
};
