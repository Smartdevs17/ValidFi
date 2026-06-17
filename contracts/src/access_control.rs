use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

use crate::errors::Error;

#[contracttype]
#[derive(Clone)]
pub struct AccessPermission {
    pub grantor: Address,
    pub grantee: Address,
    pub resource_id: u64,
    pub access_expiry: u64,
    pub is_active: bool,
    pub granted_at: u64,
}

#[contract]
pub struct AccessControl;

#[contractimpl]
impl AccessControl {
    pub fn grant_access(
        env: &Env,
        grantor: Address,
        grantee: Address,
        resource_id: u64,
        duration_seconds: u64,
    ) -> u64 {
        grantor.require_auth();

        let permission_id = env
            .storage()
            .instance()
            .get::<_, u64>(&"permission_counter")
            .unwrap_or(0u64)
            + 1;

        let permission = AccessPermission {
            grantor: grantor.clone(),
            grantee: grantee.clone(),
            resource_id,
            access_expiry: env.ledger().timestamp() + duration_seconds,
            is_active: true,
            granted_at: env.ledger().timestamp(),
        };

        env.storage()
            .instance()
            .set(&"permission_counter", &permission_id);
        env.storage()
            .instance()
            .set(&(permission_id, "permission"), &permission);
        env.storage()
            .instance()
            .set(&(grantee, resource_id), &permission_id);

        permission_id
    }

    pub fn revoke_access(env: &Env, permission_id: u64) -> Result<(), Error> {
        let mut permission: AccessPermission = env
            .storage()
            .instance()
            .get(&(permission_id, "permission"))
            .ok_or(Error::PermissionNotFound)?;

        permission.grantor.require_auth();
        permission.is_active = false;

        env.storage()
            .instance()
            .set(&(permission_id, "permission"), &permission);
        Ok(())
    }

    pub fn check_access(env: &Env, grantee: Address, resource_id: u64) -> bool {
        let permission_id: u64 = match env.storage().instance().get(&(grantee, resource_id)) {
            Some(id) => id,
            None => return false,
        };

        let permission: AccessPermission =
            match env.storage().instance().get(&(permission_id, "permission")) {
                Some(p) => p,
                None => return false,
            };

        permission.is_active && env.ledger().timestamp() <= permission.access_expiry
    }

    pub fn get_permission(env: &Env, permission_id: u64) -> Result<AccessPermission, Error> {
        env.storage()
            .instance()
            .get(&(permission_id, "permission"))
            .ok_or(Error::PermissionNotFound)
    }

    pub fn extend_access(
        env: &Env,
        permission_id: u64,
        additional_seconds: u64,
    ) -> Result<(), Error> {
        let mut permission: AccessPermission = env
            .storage()
            .instance()
            .get(&(permission_id, "permission"))
            .ok_or(Error::PermissionNotFound)?;

        permission.grantor.require_auth();
        permission.access_expiry += additional_seconds;

        env.storage()
            .instance()
            .set(&(permission_id, "permission"), &permission);
        Ok(())
    }
}
