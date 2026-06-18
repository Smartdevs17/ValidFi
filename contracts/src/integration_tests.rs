extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Bytes, BytesN, Env, String,
};

use crate::{
    access_control::{AccessControl, AccessControlClient},
    data_sharing::{DataSharing, DataSharingClient},
    identity_registry::{IdentityRegistry, IdentityRegistryClient},
    verification::{Verification, VerificationClient},
};

fn setup() -> (
    Env,
    IdentityRegistryClient<'static>,
    VerificationClient<'static>,
    AccessControlClient<'static>,
    DataSharingClient<'static>,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    let identity_id = env.register_contract(None, IdentityRegistry {});
    let identity = IdentityRegistryClient::new(&env, &identity_id);

    let verification_id = env.register_contract(None, Verification {});
    let verification = VerificationClient::new(&env, &verification_id);

    let access_id = env.register_contract(None, AccessControl {});
    let access = AccessControlClient::new(&env, &access_id);

    let sharing_id = env.register_contract(None, DataSharing {});
    let sharing = DataSharingClient::new(&env, &sharing_id);

    (env, identity, verification, access, sharing, admin)
}

// ── Identity Registry Integration ─────────────────────────────────────────────

#[test]
fn test_register_and_get_identity() {
    let (env, identity, _, _, _, _) = setup();
    let owner = Address::generate(&env);
    let doc_hash = BytesN::from_array(&env, &[1u8; 32]);
    let cid = String::from_str(&env, "QmTestCID123");

    let id = identity.register_identity(&owner, &doc_hash, &cid);
    let result = identity.get_identity(&id);

    assert_eq!(result.owner, owner);
    assert_eq!(result.document_hash, doc_hash);
    assert_eq!(result.ipfs_cid, cid);
    assert!(!result.verification_status);
    assert!(!result.revoked);
}

#[test]
fn test_update_identity_changes_hash_and_cid() {
    let (env, identity, _, _, _, _) = setup();
    let owner = Address::generate(&env);
    let doc_hash = BytesN::from_array(&env, &[1u8; 32]);
    let cid = String::from_str(&env, "QmOriginal");

    let id = identity.register_identity(&owner, &doc_hash, &cid);

    let new_hash = BytesN::from_array(&env, &[2u8; 32]);
    let new_cid = String::from_str(&env, "QmUpdated");
    identity.update_identity(&id, &new_hash, &new_cid);

    let result = identity.get_identity(&id);
    assert_eq!(result.document_hash, new_hash);
    assert_eq!(result.ipfs_cid, new_cid);
}

#[test]
fn test_revoke_identity_marks_as_revoked() {
    let (env, identity, _, _, _, _) = setup();
    let owner = Address::generate(&env);
    let doc_hash = BytesN::from_array(&env, &[1u8; 32]);
    let cid = String::from_str(&env, "QmRevocable");

    let id = identity.register_identity(&owner, &doc_hash, &cid);
    identity.revoke_identity(&id);

    let result = identity.get_identity(&id);
    assert!(result.revoked);
}

#[test]
fn test_register_multiple_identities_same_owner() {
    let (env, identity, _, _, _, _) = setup();
    let owner = Address::generate(&env);
    let doc_hash = BytesN::from_array(&env, &[1u8; 32]);

    let id1 = identity.register_identity(&owner, &doc_hash, &String::from_str(&env, "QmFirst"));
    let id2 = identity.register_identity(&owner, &doc_hash, &String::from_str(&env, "QmSecond"));

    assert_eq!(id1, 1);
    assert_eq!(id2, 2);

    let r1 = identity.get_identity(&id1);
    let r2 = identity.get_identity(&id2);
    assert_eq!(r1.owner, owner);
    assert_eq!(r2.owner, owner);
    assert_eq!(r1.document_hash, doc_hash);
    assert_eq!(r2.document_hash, doc_hash);
}

#[test]
fn test_mark_verified_and_is_verified() {
    let (env, identity, _, _, _, _) = setup();
    let owner = Address::generate(&env);
    let doc_hash = BytesN::from_array(&env, &[1u8; 32]);

    let id = identity.register_identity(&owner, &doc_hash, &String::from_str(&env, "QmVerify"));

    assert!(!identity.is_verified(&id));
    identity.mark_verified(&id);
    assert!(identity.is_verified(&id));
}

#[test]
fn test_revoked_identity_not_verified() {
    let (env, identity, _, _, _, _) = setup();
    let owner = Address::generate(&env);
    let doc_hash = BytesN::from_array(&env, &[1u8; 32]);

    let id = identity.register_identity(&owner, &doc_hash, &String::from_str(&env, "QmRevVer"));
    identity.mark_verified(&id);
    assert!(identity.is_verified(&id));

    identity.revoke_identity(&id);
    assert!(!identity.is_verified(&id));
}

// ── Verification Integration ──────────────────────────────────────────────────

#[test]
fn test_submit_and_approve_verification() {
    let (env, identity, verification, _, _, _) = setup();
    let user = Address::generate(&env);
    let verifier = Address::generate(&env);
    let doc_hash = BytesN::from_array(&env, &[1u8; 32]);

    let identity_id =
        identity.register_identity(&user, &doc_hash, &String::from_str(&env, "QmVer"));

    let proof_hash = BytesN::from_array(&env, &[42u8; 32]);
    let commitment = BytesN::from_array(&env, &[99u8; 32]);
    let v_id = verification.submit_proof(&identity_id, &verifier, &proof_hash, &commitment);

    let record = verification.get_verification(&v_id);
    assert_eq!(record.identity_id, identity_id);
    assert_eq!(record.verifier, verifier);
    assert_eq!(record.status, String::from_str(&env, "pending"));

    verification.approve_verification(&v_id);
    let approved = verification.get_verification(&v_id);
    assert_eq!(approved.status, String::from_str(&env, "approved"));
}

#[test]
fn test_submit_and_reject_verification() {
    let (env, identity, verification, _, _, _) = setup();
    let user = Address::generate(&env);
    let verifier = Address::generate(&env);
    let doc_hash = BytesN::from_array(&env, &[1u8; 32]);

    let identity_id =
        identity.register_identity(&user, &doc_hash, &String::from_str(&env, "QmRej"));

    let proof_hash = BytesN::from_array(&env, &[42u8; 32]);
    let commitment = BytesN::from_array(&env, &[99u8; 32]);
    let v_id = verification.submit_proof(&identity_id, &verifier, &proof_hash, &commitment);

    let reason = String::from_str(&env, "insufficient_proof");
    verification.reject_verification(&v_id, &reason);
    let rejected = verification.get_verification(&v_id);
    assert_eq!(rejected.status, String::from_str(&env, "rejected"));
}

#[test]
fn test_get_verification_status() {
    let (env, identity, verification, _, _, _) = setup();
    let user = Address::generate(&env);
    let verifier = Address::generate(&env);
    let doc_hash = BytesN::from_array(&env, &[1u8; 32]);

    let identity_id =
        identity.register_identity(&user, &doc_hash, &String::from_str(&env, "QmStatus"));

    let proof_hash = BytesN::from_array(&env, &[1u8; 32]);
    let commitment = BytesN::from_array(&env, &[2u8; 32]);
    let v_id = verification.submit_proof(&identity_id, &verifier, &proof_hash, &commitment);

    assert_eq!(
        verification.get_verification_status(&v_id),
        String::from_str(&env, "pending")
    );

    verification.approve_verification(&v_id);
    assert_eq!(
        verification.get_verification_status(&v_id),
        String::from_str(&env, "approved")
    );
}

#[test]
fn test_get_verification_by_identity() {
    let (env, identity, verification, _, _, _) = setup();
    let user = Address::generate(&env);
    let verifier = Address::generate(&env);
    let doc_hash = BytesN::from_array(&env, &[1u8; 32]);

    let identity_id =
        identity.register_identity(&user, &doc_hash, &String::from_str(&env, "QmById"));

    let proof_hash = BytesN::from_array(&env, &[1u8; 32]);
    let commitment = BytesN::from_array(&env, &[2u8; 32]);
    let v_id = verification.submit_proof(&identity_id, &verifier, &proof_hash, &commitment);

    let found_id = verification.get_verification_by_identity(&identity_id);
    assert_eq!(found_id, v_id);
}

// ── Access Control Integration ────────────────────────────────────────────────

#[test]
fn test_grant_and_check_access() {
    let (env, _, _, access, _, _) = setup();
    let grantor = Address::generate(&env);
    let grantee = Address::generate(&env);
    let resource_id: u64 = 1;

    let permission_id = access.grant_access(&grantor, &grantee, &resource_id, &3600);
    assert!(permission_id > 0);

    assert!(access.check_access(&grantee, &resource_id));
}

#[test]
fn test_check_access_denied_for_unknown() {
    let (env, _, _, access, _, _) = setup();
    let grantee = Address::generate(&env);

    assert!(!access.check_access(&grantee, &999));
}

#[test]
fn test_revoke_access() {
    let (env, _, _, access, _, _) = setup();
    let grantor = Address::generate(&env);
    let grantee = Address::generate(&env);

    let pid = access.grant_access(&grantor, &grantee, &1, &3600);
    assert!(access.check_access(&grantee, &1));

    access.revoke_access(&pid);
    assert!(!access.check_access(&grantee, &1));
}

#[test]
fn test_access_expires_after_duration() {
    let (env, _, _, access, _, _) = setup();
    let grantor = Address::generate(&env);
    let grantee = Address::generate(&env);
    let start_ts = env.ledger().timestamp();

    let _pid = access.grant_access(&grantor, &grantee, &1, &100);
    assert!(access.check_access(&grantee, &1));

    env.ledger().set_timestamp(start_ts + 200);
    assert!(!access.check_access(&grantee, &1));
}

#[test]
fn test_extend_access() {
    let (env, _, _, access, _, _) = setup();
    let grantor = Address::generate(&env);
    let grantee = Address::generate(&env);
    let start_ts = env.ledger().timestamp();

    let pid = access.grant_access(&grantor, &grantee, &1, &100);
    access.extend_access(&pid, &200);

    env.ledger().set_timestamp(start_ts + 150);
    assert!(access.check_access(&grantee, &1));

    env.ledger().set_timestamp(start_ts + 350);
    assert!(!access.check_access(&grantee, &1));
}

#[test]
fn test_get_permission() {
    let (env, _, _, access, _, _) = setup();
    let grantor = Address::generate(&env);
    let grantee = Address::generate(&env);

    let pid = access.grant_access(&grantor, &grantee, &42, &7200);
    let perm = access.get_permission(&pid);

    assert_eq!(perm.grantor, grantor);
    assert_eq!(perm.grantee, grantee);
    assert_eq!(perm.resource_id, 42);
    assert!(perm.is_active);
}

// ── Data Sharing Integration ─────────────────────────────────────────────────

#[test]
fn test_share_document_and_retrieve() {
    let (env, _, _, _, sharing, _) = setup();
    let owner = Address::generate(&env);
    let recipient = Address::generate(&env);
    let doc_hash = BytesN::from_array(&env, &[1u8; 32]);
    let enc_key = Bytes::from_array(&env, &[10u8; 16]);

    let share_id = sharing.share_document(&owner, &recipient, &doc_hash, &enc_key, &86400);
    let result = sharing.get_shared_document(&share_id);

    assert_eq!(result.owner, owner);
    assert_eq!(result.recipient, recipient);
    assert_eq!(result.document_hash, doc_hash);
    assert!(result.is_active);
}

#[test]
fn test_is_share_active() {
    let (env, _, _, _, sharing, _) = setup();
    let owner = Address::generate(&env);
    let recipient = Address::generate(&env);

    let share_id = sharing.share_document(
        &owner,
        &recipient,
        &BytesN::from_array(&env, &[1u8; 32]),
        &Bytes::from_array(&env, &[10u8; 16]),
        &86400,
    );

    assert!(sharing.is_share_active(&share_id));
}

#[test]
fn test_revoke_shared_document() {
    let (env, _, _, _, sharing, _) = setup();
    let owner = Address::generate(&env);
    let recipient = Address::generate(&env);

    let share_id = sharing.share_document(
        &owner,
        &recipient,
        &BytesN::from_array(&env, &[1u8; 32]),
        &Bytes::from_array(&env, &[10u8; 16]),
        &86400,
    );

    assert!(sharing.is_share_active(&share_id));
    sharing.revoke_shared_document(&share_id);
    assert!(!sharing.is_share_active(&share_id));
}

#[test]
fn test_get_shared_document_by_parties() {
    let (env, _, _, _, sharing, _) = setup();
    let owner = Address::generate(&env);
    let recipient = Address::generate(&env);
    let doc_hash = BytesN::from_array(&env, &[1u8; 32]);

    let share_id = sharing.share_document(
        &owner,
        &recipient,
        &doc_hash,
        &Bytes::from_array(&env, &[10u8; 16]),
        &3600,
    );

    let found = sharing.get_shared_document_by_parties(&owner, &recipient, &doc_hash);
    assert_eq!(found, share_id);
}

#[test]
fn test_share_expires_after_duration() {
    let (env, _, _, _, sharing, _) = setup();
    let owner = Address::generate(&env);
    let recipient = Address::generate(&env);
    let start_ts = env.ledger().timestamp();

    let share_id = sharing.share_document(
        &owner,
        &recipient,
        &BytesN::from_array(&env, &[1u8; 32]),
        &Bytes::from_array(&env, &[10u8; 16]),
        &100,
    );

    assert!(sharing.is_share_active(&share_id));

    env.ledger().set_timestamp(start_ts + 200);
    assert!(!sharing.is_share_active(&share_id));
}

#[test]
fn test_extend_share() {
    let (env, _, _, _, sharing, _) = setup();
    let owner = Address::generate(&env);
    let recipient = Address::generate(&env);
    let start_ts = env.ledger().timestamp();

    let share_id = sharing.share_document(
        &owner,
        &recipient,
        &BytesN::from_array(&env, &[1u8; 32]),
        &Bytes::from_array(&env, &[10u8; 16]),
        &100,
    );

    sharing.extend_share(&share_id, &200);

    env.ledger().set_timestamp(start_ts + 150);
    assert!(sharing.is_share_active(&share_id));

    env.ledger().set_timestamp(start_ts + 350);
    assert!(!sharing.is_share_active(&share_id));
}

// ── End-to-End Credential Flow ────────────────────────────────────────────────

#[test]
fn test_full_credential_lifecycle() {
    let (env, identity, verification, access, sharing, _) = setup();
    let patient = Address::generate(&env);
    let doctor = Address::generate(&env);
    let insurer = Address::generate(&env);
    let doc_hash = BytesN::from_array(&env, &[1u8; 32]);
    let proof_hash = BytesN::from_array(&env, &[42u8; 32]);
    let commitment = BytesN::from_array(&env, &[99u8; 32]);
    let enc_key = Bytes::from_array(&env, &[10u8; 16]);

    // 1. Patient registers identity
    let identity_id = identity.register_identity(
        &patient,
        &doc_hash,
        &String::from_str(&env, "QmPatientRecord"),
    );
    assert!(identity_id > 0);

    // 2. Doctor submits verification proof
    let v_id = verification.submit_proof(&identity_id, &doctor, &proof_hash, &commitment);

    // 3. Doctor approves verification
    verification.approve_verification(&v_id);
    assert_eq!(
        verification.get_verification_status(&v_id),
        String::from_str(&env, "approved")
    );

    // 4. Patient marks identity as verified on-chain
    identity.mark_verified(&identity_id);
    assert!(identity.is_verified(&identity_id));

    // 5. Patient grants insurer access to the verified credential
    let resource_id = identity_id;
    let permission_id = access.grant_access(&patient, &insurer, &resource_id, &2592000);
    assert!(access.check_access(&insurer, &resource_id));

    // 6. Patient shares encrypted document with insurer
    let share_id = sharing.share_document(&patient, &insurer, &doc_hash, &enc_key, &2592000);
    assert!(sharing.is_share_active(&share_id));

    // 7. Verify the full chain: insurer has access and can retrieve shared doc
    let shared = sharing.get_shared_document(&share_id);
    assert_eq!(shared.owner, patient);
    assert_eq!(shared.recipient, insurer);
    assert!(shared.is_active);

    // 8. Patient revokes access
    access.revoke_access(&permission_id);
    assert!(!access.check_access(&insurer, &resource_id));

    // 9. Patient revokes the shared document
    sharing.revoke_shared_document(&share_id);
    assert!(!sharing.is_share_active(&share_id));
}

// ── Error Scenarios ───────────────────────────────────────────────────────────

#[test]
#[should_panic]
fn test_get_nonexistent_identity_panics() {
    let (_, identity, _, _, _, _) = setup();
    identity.get_identity(&999);
}

#[test]
#[should_panic]
fn test_update_nonexistent_identity_panics() {
    let (env, identity, _, _, _, _) = setup();
    let hash = BytesN::from_array(&env, &[1u8; 32]);
    let cid = String::from_str(&env, "QmFail");
    identity.update_identity(&999, &hash, &cid);
}

#[test]
#[should_panic]
fn test_revoke_nonexistent_identity_panics() {
    let (_, identity, _, _, _, _) = setup();
    identity.revoke_identity(&999);
}

#[test]
#[should_panic]
fn test_mark_verified_nonexistent_identity_panics() {
    let (_, identity, _, _, _, _) = setup();
    identity.mark_verified(&999);
}

#[test]
#[should_panic]
fn test_get_nonexistent_verification_panics() {
    let (_, _, verification, _, _, _) = setup();
    verification.get_verification(&999);
}

#[test]
#[should_panic]
fn test_approve_nonexistent_verification_panics() {
    let (_, _, verification, _, _, _) = setup();
    verification.approve_verification(&999);
}

#[test]
#[should_panic]
fn test_reject_nonexistent_verification_panics() {
    let (env, _, verification, _, _, _) = setup();
    let reason = String::from_str(&env, "invalid");
    verification.reject_verification(&999, &reason);
}

#[test]
#[should_panic]
fn test_get_verification_by_nonexistent_identity_panics() {
    let (_, _, verification, _, _, _) = setup();
    verification.get_verification_by_identity(&999);
}

#[test]
#[should_panic]
fn test_get_verification_status_nonexistent_panics() {
    let (_, _, verification, _, _, _) = setup();
    verification.get_verification_status(&999);
}

#[test]
#[should_panic]
fn test_revoke_nonexistent_permission_panics() {
    let (_, _, _, access, _, _) = setup();
    access.revoke_access(&999);
}

#[test]
#[should_panic]
fn test_get_nonexistent_permission_panics() {
    let (_, _, _, access, _, _) = setup();
    access.get_permission(&999);
}

#[test]
#[should_panic]
fn test_extend_nonexistent_permission_panics() {
    let (_, _, _, access, _, _) = setup();
    access.extend_access(&999, &3600);
}

#[test]
#[should_panic]
fn test_get_nonexistent_shared_document_panics() {
    let (_, _, _, _, sharing, _) = setup();
    sharing.get_shared_document(&999);
}

#[test]
#[should_panic]
fn test_revoke_nonexistent_share_panics() {
    let (_, _, _, _, sharing, _) = setup();
    sharing.revoke_shared_document(&999);
}

#[test]
#[should_panic]
fn test_get_nonexistent_shared_document_by_parties_panics() {
    let (env, _, _, _, sharing, _) = setup();
    let owner = Address::generate(&env);
    let recipient = Address::generate(&env);
    let hash = BytesN::from_array(&env, &[1u8; 32]);
    sharing.get_shared_document_by_parties(&owner, &recipient, &hash);
}

#[test]
#[should_panic]
fn test_is_share_active_nonexistent_panics() {
    let (_, _, _, _, sharing, _) = setup();
    sharing.is_share_active(&999);
}

#[test]
#[should_panic]
fn test_extend_nonexistent_share_panics() {
    let (_, _, _, _, sharing, _) = setup();
    sharing.extend_share(&999, &3600);
}
