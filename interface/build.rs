use std::env;
use std::fs;
use std::path::Path;

use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct Idl {
    instructions: Vec<Instruction>,
    address: String,
    types: Option<Vec<TypeDef>>,
}

#[derive(Debug, Deserialize)]
struct Instruction {
    name: String,
    discriminator: Vec<u8>,
    accounts: Vec<Account>,
    args: Vec<Arg>,
}

#[derive(Debug, Deserialize)]
struct Account {
    name: String,
    writable: Option<bool>,
    signer: Option<bool>,
    address: Option<String>,
    pda: Option<Pda>,
    optional: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct Pda {
    seeds: Vec<Seed>,
}

#[derive(Debug, Deserialize)]
struct Seed {
    kind: String,
    value: Option<Vec<u8>>,
    path: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Arg {
    name: String,
    #[serde(rename = "type")]
    ty: ArgType,
}

#[derive(Debug, Deserialize)]
struct DefinedType {
    name: String,
}

#[derive(Debug, Deserialize)]
struct TypeDef {
    name: String,
    #[serde(rename = "type")]
    ty: TypeDefType,
}

#[derive(Debug, Deserialize)]
struct TypeDefType {
    kind: String,
    fields: Option<Vec<TypeDefField>>,
}

#[derive(Debug, Deserialize)]
struct TypeDefField {
    name: String,
    #[serde(rename = "type")]
    ty: ArgType,
}

/// Represents an array type element - can be either a simple string type or a complex type
#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum ArrayElementType {
    Simple(String),
    Complex(Box<ArgType>),
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum ArgType {
    Simple(String),
    Array { array: (ArrayElementType, usize) },
    Option { option: Box<ArgType> },
    VecNested { vec: Box<ArgType> },
    Defined { defined: DefinedType },
}

fn to_pascal_case(s: &str) -> String {
    s.split('_')
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().chain(chars).collect(),
            }
        })
        .collect()
}

fn type_to_rust(ty: &ArgType, use_types_prefix: bool) -> String {
    match ty {
        ArgType::Simple(s) => match s.as_str() {
            "u8" | "u16" | "u32" | "u64" | "u128" => s.clone(),
            "i8" | "i16" | "i32" | "i64" | "i128" => s.clone(),
            "bool" => "bool".to_string(),
            "string" => "String".to_string(),
            "bytes" => "Vec<u8>".to_string(),
            "publicKey" | "pubkey" => "Pubkey".to_string(),
            _ => s.clone(),
        },
        ArgType::Array { array } => {
            let (element_type, size) = array;
            let inner_type = match element_type {
                ArrayElementType::Simple(s) => {
                    type_to_rust(&ArgType::Simple(s.clone()), use_types_prefix)
                }
                ArrayElementType::Complex(complex) => type_to_rust(complex, use_types_prefix),
            };
            format!("[{}; {}]", inner_type, size)
        }
        ArgType::Option { option } => {
            format!("Option<{}>", type_to_rust(option, use_types_prefix))
        }
        ArgType::VecNested { vec } => {
            let inner = type_to_rust(vec, use_types_prefix);
            format!("Vec<{}>", inner)
        }
        ArgType::Defined { defined } => {
            if use_types_prefix {
                format!("types::{}", defined.name)
            } else {
                defined.name.clone()
            }
        }
    }
}

fn generate_types_mod(types: &[TypeDef]) -> String {
    let mut code = String::from(
        r#"pub mod types {
    use anchor_lang::prelude::*;

"#,
    );

    for ty in types {
        if ty.ty.kind == "struct" {
            code.push_str("    #[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]\n");
            code.push_str(&format!("    pub struct {} {{\n", ty.name));

            if let Some(fields) = &ty.ty.fields {
                for field in fields {
                    let rust_type = type_to_rust(&field.ty, false);
                    code.push_str(&format!("        pub {}: {},\n", field.name, rust_type));
                }
            }

            code.push_str("    }\n\n");
        }
    }

    code.push_str("}\n");
    code
}

fn generate_accounts_mod(instructions: &[Instruction], program_id: &str) -> String {
    let mut code = String::from(
        r#"pub mod accounts {
    use std::str::FromStr;
    use anchor_lang::{ToAccountMetas, prelude::Pubkey};
    use solana_instruction::AccountMeta;

"#,
    );

    for instr in instructions {
        let struct_name = to_pascal_case(&instr.name);

        code.push_str("    #[derive(Debug, Default)]\n");
        code.push_str(&format!("    pub struct {} {{\n", struct_name));

        for acc in &instr.accounts {
            let is_optional = acc.optional.unwrap_or(false);

            if acc.address.is_none() && !is_optional {
                code.push_str(&format!("        pub {}: Pubkey,\n", acc.name));
            } else {
                code.push_str(&format!("        pub {}: Option<Pubkey>,\n", acc.name));
            }
        }

        code.push_str("    }\n\n");

        code.push_str(&format!("    impl {} {{\n", struct_name));

        // Add PDA functions for each account in this instruction
        for acc in &instr.accounts {
            if let Some(pda) = &acc.pda {
                let mut seed_params = Vec::new();
                let mut seed_code = Vec::new();

                let arg_type_map = instr
                    .args
                    .iter()
                    .map(|a| (a.name.as_str(), &a.ty))
                    .collect::<std::collections::HashMap<_, _>>();

                for seed in &pda.seeds {
                    match seed.kind.as_str() {
                        "const" => {
                            if let Some(value) = &seed.value {
                                let bytes_str = value
                                    .iter()
                                    .map(|b| b.to_string())
                                    .collect::<Vec<_>>()
                                    .join(", ");
                                seed_code.push(format!("            &[{}]", bytes_str));
                            }
                        }
                        "account" => {
                            if let Some(path) = &seed.path {
                                let param_name = path.replace(".", "_");
                                seed_params.push(format!("{}: Pubkey", param_name));
                                seed_code.push(format!("            {}.as_ref()", param_name));
                            }
                        }
                        "arg" => {
                            if let Some(path) = &seed.path {
                                let param_name = path.replace(".", "_");
                                let arg_ty = arg_type_map
                                    .get(path.as_str())
                                    .expect("PDA seed arg not found in instruction args");

                                match arg_ty {
                                    ArgType::Simple(s)
                                        if s.starts_with('u') || s.starts_with('i') =>
                                    {
                                        seed_params.push(format!("{}: {}", param_name, s));
                                        seed_code.push(format!(
                                            "            {}.to_le_bytes().as_ref()",
                                            param_name
                                        ));
                                    }
                                    ArgType::Simple(s) if s == "string" => {
                                        seed_params.push(format!("{}: &str", param_name));
                                        seed_code
                                            .push(format!("            {}.as_bytes()", param_name));
                                    }
                                    ArgType::Simple(s) if s == "bytes" => {
                                        seed_params.push(format!("{}: &[u8]", param_name));
                                        seed_code.push(format!("            {}", param_name));
                                    }
                                    ArgType::Simple(s) if s == "publicKey" || s == "pubkey" => {
                                        seed_params.push(format!("{}: Pubkey", param_name));
                                        seed_code
                                            .push(format!("            {}.as_ref()", param_name));
                                    }
                                    ArgType::Array { .. } => {
                                        seed_params.push(format!("{}: &[u8]", param_name));
                                        seed_code.push(format!("            {}", param_name));
                                    }
                                    _ => {
                                        seed_params.push(format!("{}: &[u8]", param_name));
                                        seed_code.push(format!("            {}", param_name));
                                    }
                                }
                            }
                        }
                        _ => {}
                    }
                }

                let params_str = seed_params.join(", ");
                let seeds_str = seed_code.join(",\n");

                // Don't add _pda suffix twice - the account name already ends with _pda
                let function_name = if acc.name.ends_with("_pda") {
                    acc.name.clone()
                } else {
                    format!("{}_pda", acc.name)
                };

                code.push_str(&format!(
                    "        pub fn {}(program_id: &Pubkey, {}) -> (Pubkey, u8) {{\n",
                    function_name, params_str
                ));
                code.push_str("            Pubkey::find_program_address(&[\n");
                code.push_str(&seeds_str);
                code.push_str("\n            ], program_id)\n");
                code.push_str("        }\n\n");
            }
        }

        code.push_str("    }\n\n");

        code.push_str(&format!("    impl ToAccountMetas for {} {{\n", struct_name));
        code.push_str(
            "        fn to_account_metas(&self, _is_signer: Option<bool>) -> Vec<AccountMeta> {\n",
        );
        code.push_str("            vec![\n");

        for acc in &instr.accounts {
            let is_writable = acc.writable.unwrap_or(false);
            let is_signer = acc.signer.unwrap_or(false);
            let is_optional = acc.optional.unwrap_or(false);

            let account_expr = if let Some(addr) = &acc.address {
                // Fixed address account - use provided value or fall back to the fixed address
                format!(
                    "self.{}.unwrap_or_else(|| Pubkey::from_str(\"{}\").unwrap())",
                    acc.name, addr
                )
            } else if is_optional {
                // Optional account - use provided value or fall back to program_id as placeholder
                format!(
                    "self.{}.unwrap_or_else(|| Pubkey::from_str(\"{}\").unwrap())",
                    acc.name, program_id
                )
            } else {
                // Required account
                format!("self.{}", acc.name)
            };

            if is_writable {
                code.push_str(&format!(
                    "                AccountMeta::new({}, {}),\n",
                    account_expr, is_signer
                ));
            } else {
                code.push_str(&format!(
                    "                AccountMeta::new_readonly({}, {}),\n",
                    account_expr, is_signer
                ));
            }
        }

        code.push_str("            ]\n");
        code.push_str("        }\n");
        code.push_str("    }\n\n");
    }

    code.push_str("}\n");
    code
}

fn generate_instructions_mod(instructions: &[Instruction]) -> String {
    let mut code = String::from(
        r#"pub mod instructions {
    use anchor_lang::{InstructionData, prelude::*};
    use super::types;

"#,
    );

    for instr in instructions {
        let struct_name = to_pascal_case(&instr.name);

        code.push_str("    #[derive(AnchorSerialize)]\n");
        code.push_str(&format!("    pub struct {} {{\n", struct_name));

        for arg in &instr.args {
            let rust_type = type_to_rust(&arg.ty, true);
            code.push_str(&format!("        pub {}: {},\n", arg.name, rust_type));
        }

        code.push_str("    }\n\n");

        code.push_str(&format!("    impl Discriminator for {} {{\n", struct_name));
        code.push_str("        const DISCRIMINATOR: &'static [u8] = &[");
        code.push_str(
            &instr
                .discriminator
                .iter()
                .map(|b| b.to_string())
                .collect::<Vec<_>>()
                .join(", "),
        );
        code.push_str("];\n");
        code.push_str("    }\n\n");

        code.push_str(&format!(
            "    impl InstructionData for {} {{}}\n\n",
            struct_name
        ));
    }

    code.push_str("}\n");
    code
}

fn generate_instruction_builders(instructions: &[Instruction]) -> String {
    let mut code = String::from(
        r#"use anchor_lang::{InstructionData, ToAccountMetas, prelude::Pubkey};
use solana_instruction::Instruction;

"#,
    );

    for instr in instructions {
        let struct_name = to_pascal_case(&instr.name);
        code.push_str(&format!(
            "pub fn {}(program_id: &Pubkey, accounts: accounts::{}, args: instructions::{}) -> Instruction {{\n",
            instr.name, struct_name, struct_name
        ));
        code.push_str(
            "    Instruction {\n        program_id: *program_id,\n        accounts: accounts.to_account_metas(None),\n        data: args.data(),\n    }\n",
        );
        code.push_str("}\n\n");
    }

    code
}

fn main() {
    let idl_path = env::var("IDL_PATH")
        .unwrap_or_else(|_| "../solana/target/idl/solana_programs.json".to_string());
    let out_dir = env::var("OUT_DIR").unwrap();

    println!("cargo:rerun-if-changed={}", idl_path);

    let idl_content = fs::read_to_string(&idl_path)
        .unwrap_or_else(|_| panic!("Failed to read IDL file at {}", idl_path));

    let idl: Idl = serde_json::from_str(&idl_content)
        .unwrap_or_else(|e| panic!("Failed to parse IDL JSON: {}", e));

    let types_code = if let Some(ref types) = idl.types {
        generate_types_mod(types)
    } else {
        String::from("pub mod types {}\n")
    };

    let accounts_code = generate_accounts_mod(&idl.instructions, &idl.address);
    let instructions_code = generate_instructions_mod(&idl.instructions);
    let builders_code = generate_instruction_builders(&idl.instructions);
    let program_id = format!(
        r#"
        use anchor_lang::pubkey;
        pub const PROGRAM_ID: Pubkey = pubkey!("{}");
        "#,
        idl.address
    );
    let generated_code = format!(
        "{}\n{}\n{}\n{}\n{}",
        program_id, types_code, accounts_code, instructions_code, builders_code
    );

    let dest_path = Path::new(&out_dir).join("generated.rs");
    fs::write(&dest_path, generated_code).expect("Failed to write generated code");

    println!("cargo:warning=Generated code written to {:?}", dest_path);
}
