pub mod errors;
pub mod identity_registry;
pub mod verification;
pub mod access_control;
pub mod data_sharing;
pub mod upgrade;

#[cfg(test)]
mod upgrade_tests;

pub use errors::Error;
pub use identity_registry::IdentityRegistry;
pub use verification::Verification;
pub use access_control::AccessControl;
pub use data_sharing::DataSharing;
