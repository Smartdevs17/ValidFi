use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, BytesN, Env};

use crate::errors::Error;

#[contracttype]
#[derive(Clone)]
pub struct SharedData {
    pub owner: Address,
    pub recipient: Address,
    pub document_hash: BytesN<32>,
    pub encrypted_key: Bytes,
    pub access_expiry: u64,
    pub is_active: bool,
    pub shared_at: u64,
}

#[contract]
pub struct DataSharing;

#[contractimpl]
impl DataSharing {
    pub fn share_document(
        env: &Env,
        owner: Address,
        recipient: Address,
        document_hash: BytesN<32>,
        encrypted_key: Bytes,
        duration_seconds: u64,
    ) -> u64 {
        owner.require_auth();

        let share_id = env
            .storage()
            .instance()
            .get::<_, u64>(&"share_counter")
            .unwrap_or(0u64)
            + 1;

        let shared_data = SharedData {
            owner: owner.clone(),
            recipient: recipient.clone(),
            document_hash: document_hash.clone(),
            encrypted_key,
            access_expiry: env.ledger().timestamp() + duration_seconds,
            is_active: true,
            shared_at: env.ledger().timestamp(),
        };

        env.storage().instance().set(&"share_counter", &share_id);
        env.storage()
            .instance()
            .set(&(share_id, "shared_data"), &shared_data);
        env.storage()
            .instance()
            .set(&(owner, recipient, document_hash), &share_id);

        share_id
    }

    pub fn revoke_shared_document(env: &Env, share_id: u64) -> Result<(), Error> {
        let mut shared_data: SharedData = env
            .storage()
            .instance()
            .get(&(share_id, "shared_data"))
            .ok_or(Error::SharedDocumentNotFound)?;

        shared_data.owner.require_auth();
        shared_data.is_active = false;

        env.storage()
            .instance()
            .set(&(share_id, "shared_data"), &shared_data);
        Ok(())
    }

    pub fn get_shared_document(env: &Env, share_id: u64) -> Result<SharedData, Error> {
        env.storage()
            .instance()
            .get(&(share_id, "shared_data"))
            .ok_or(Error::SharedDocumentNotFound)
    }

    pub fn get_shared_document_by_parties(
        env: &Env,
        owner: Address,
        recipient: Address,
        document_hash: BytesN<32>,
    ) -> Result<u64, Error> {
        env.storage()
            .instance()
            .get(&(owner, recipient, document_hash))
            .ok_or(Error::SharedDocumentNotFound)
    }

    pub fn is_share_active(env: &Env, share_id: u64) -> Result<bool, Error> {
        let shared_data: SharedData = env
            .storage()
            .instance()
            .get(&(share_id, "shared_data"))
            .ok_or(Error::SharedDocumentNotFound)?;

        Ok(shared_data.is_active && env.ledger().timestamp() <= shared_data.access_expiry)
    }

    pub fn extend_share(env: &Env, share_id: u64, additional_seconds: u64) -> Result<(), Error> {
        let mut shared_data: SharedData = env
            .storage()
            .instance()
            .get(&(share_id, "shared_data"))
            .ok_or(Error::SharedDocumentNotFound)?;

        shared_data.owner.require_auth();
        shared_data.access_expiry += additional_seconds;

        env.storage()
            .instance()
            .set(&(share_id, "shared_data"), &shared_data);
        Ok(())
    }
}
