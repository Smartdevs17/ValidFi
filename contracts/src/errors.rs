use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    IdentityNotFound = 1,
    VerificationNotFound = 2,
    PermissionNotFound = 3,
    SharedDocumentNotFound = 4,
}
