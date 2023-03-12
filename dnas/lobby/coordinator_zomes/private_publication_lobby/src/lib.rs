use hdk::prelude::holo_hash::*;
use hdk::prelude::*;

/** Don't change */
#[cfg(feature = "exercise")]
extern crate private_publication_lobby;

#[derive(Serialize, Deserialize, Debug)]
struct GrantCapabilityToReadInput {
    reader: AgentPubKey,
    private_publication_dna_hash: DnaHash,
}

fn cap_secret() -> ExternResult<CapSecret> {
    // Wrapper around a byte array
    let bytes = random_bytes(64)?;
    let secret = CapSecret::try_from(bytes.into_vec())
        .map_err(|_| wasm_error!(WasmErrorInner::Guest("Could not build secret".into())))?;

    Ok(secret)
}

fn functions_to_grant_capability_for() -> ExternResult<GrantedFunctions> {
    let zome_name = zome_info()?.name;
    let function_name = FunctionName(String::from("request_read_private_publication_posts"));

    let mut functions: BTreeSet<(ZomeName, FunctionName)> = BTreeSet::new();
    functions.insert((zome_name, function_name));
    Ok(GrantedFunctions::Listed(functions))
  }

#[hdk_extern]
fn request_read_private_publication_posts(_: ()) -> ExternResult<String> {
    Ok("".to_string())
}

#[hdk_extern]
fn grant_capability_to_read(input: GrantCapabilityToReadInput) -> ExternResult<CapSecret> {

    let secret = cap_secret()?;

    let mut assignees: BTreeSet<AgentPubKey> = BTreeSet::new();
    assignees.insert(input.reader);

    let access = CapAccess::Assigned {
        secret: secret,
        assignees
    };

    let capability_grant = CapGrantEntry {
        functions: functions_to_grant_capability_for().map_err(|_| wasm_error!(WasmErrorInner::Guest("Could not granted_functions list within the Capability Grant".into())))?,
        access,
        tag: DnaHashB64::from(input.private_publication_dna_hash).to_string()
    };

    create_cap_grant(capability_grant)?;

    Ok(secret)
}
