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
      "name": "appendToLedger",
      "discriminator": [
        18,
        23,
        229,
        238,
        97,
        223,
        54,
        28
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
      "args": [
        {
          "name": "utxo",
          "type": {
            "defined": {
              "name": "utxo"
            }
          }
        }
      ]
    },
    {
      "name": "completeVault",
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
      "name": "initLedger",
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
      "name": "initVault",
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
      "name": "transfer",
      "discriminator": [
        163,
        52,
        200,
        231,
        140,
        3,
        69,
        186
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
          "name": "loader",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
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
        }
      ]
    },
    {
      "name": "uploadCiphertext",
      "discriminator": [
        117,
        226,
        27,
        145,
        10,
        131,
        170,
        246
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
      "args": [
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
      "name": "invalidHashMismatch",
      "msg": "Invalid previous UTXO hash provided"
    }
  ],
  "types": [
    {
      "name": "ledger",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "count",
            "type": "u64"
          },
          {
            "name": "utxos",
            "type": {
              "vec": {
                "defined": {
                  "name": "utxo"
                }
              }
            }
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
      "name": "utxo",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "epoch",
            "type": "u32"
          },
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
            "name": "prevUtxoHash",
            "type": {
              "array": [
                "u8",
                32
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
            "name": "nonce",
            "type": {
              "array": [
                "u8",
                12
              ]
            }
          },
          {
            "name": "encryptedPayload",
            "type": "bytes"
          },
          {
            "name": "kyberCiphertext",
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
