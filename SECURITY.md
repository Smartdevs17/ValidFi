# Security Policy

## Overview

ValidFi is a privacy-preserving health credential platform built on Stellar Soroban. Given the sensitive nature of health data and the critical importance of security in healthcare applications, we take security seriously and appreciate the security research community's efforts to responsibly disclose vulnerabilities.

## Supported Versions

We actively maintain and provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

### Where to Report

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities via:

1. **Email**: Send details to security@validfi.io (if available) or the project maintainers
2. **GitHub Security Advisory**: Use the [Private Security Reporting](https://github.com/GuardZero144/ValidFi/security/advisories/new) feature

### What to Include

When reporting a vulnerability, please include:

- **Type of vulnerability** (e.g., smart contract exploit, authentication bypass, data exposure)
- **Full path and location** of the affected source file(s)
- **Step-by-step instructions** to reproduce the issue
- **Proof-of-concept or exploit code** (if possible)
- **Impact assessment** - what an attacker could do with this vulnerability
- **Your recommended remediation** (if you have one)
- **Your contact information** for follow-up questions

### Response Timeline

- **Initial Response**: Within 48 hours of report submission
- **Status Update**: Within 7 days with assessment and estimated timeline
- **Fix Timeline**: Critical vulnerabilities will be addressed within 30 days
- **Public Disclosure**: After a fix is released and deployed, typically 90 days from initial report

### Bounty Program

We are considering a bug bounty program for the future. Stay tuned for updates.

## Security Best Practices

### For Users

#### Wallet Security
- **Use hardware wallets** for storing significant health credential assets
- **Never share your secret keys** or seed phrases with anyone
- **Verify contract addresses** before interacting with smart contracts
- **Enable multi-factor authentication** where available
- **Use official wallet applications** only (Freighter, Albedo, LOBSTR)

#### Health Data Protection
- **Review permissions** before sharing health credentials
- **Set appropriate expiration dates** for shared credentials
- **Monitor your verification history** regularly
- **Revoke access immediately** if you suspect unauthorized access
- **Use strong passwords** for your ValidFi account
- **Log out** after each session on shared devices

#### Privacy Best Practices
- **Minimize data sharing** - only share what's necessary
- **Use zero-knowledge proofs** whenever possible to avoid revealing personal information
- **Verify recipient addresses** before sharing credentials
- **Be cautious with public WiFi** when accessing health records
- **Keep your devices updated** with the latest security patches

### For Developers

#### Smart Contract Security

```rust
// Always validate inputs
if amount == 0 {
    return Err(Error::InvalidAmount);
}

// Check authorization before state changes
credential_owner.require_auth();

// Use safe math operations
let new_balance = current_balance.checked_add(amount)
    .ok_or(Error::Overflow)?;

// Implement access controls
if !is_authorized_authority(&env, &caller) {
    return Err(Error::Unauthorized);
}

// Validate credential expiration
if credential.expires_at < env.ledger().timestamp() {
    return Err(Error::CredentialExpired);
}
```

#### Backend Security

```typescript
// Input validation with class-validator
@IsString()
@Length(1, 100)
@Matches(/^[a-zA-Z0-9-_]+$/)
credentialId: string;

// SQL injection prevention with TypeORM
const credential = await this.credentialRepository.findOne({
  where: { id: credentialId, userId: user.id }
});

// Rate limiting
@UseGuards(ThrottlerGuard)
@Throttle(10, 60) // 10 requests per minute
async getCredential() {}

// Sanitize user input
import { sanitize } from 'class-sanitizer';
@Transform(({ value }) => sanitize(value))

// Encrypt sensitive data before storage
const encryptedData = await this.encryptionService.encrypt(healthData);
```

#### Frontend Security

```typescript
// Validate wallet signatures
const isValid = await verifyWalletSignature(
  message,
  signature,
  publicKey
);

// Sanitize user inputs
import DOMPurify from 'isomorphic-dompurify';
const cleanHtml = DOMPurify.sanitize(userInput);

// Use environment variables for sensitive config
const apiUrl = process.env.NEXT_PUBLIC_API_URL;

// Implement CSRF protection
headers: {
  'X-CSRF-Token': csrfToken
}

// Secure session management
const session = await getServerSession(authOptions);
if (!session) {
  return redirect('/login');
}
```

### Security Checklist for Pull Requests

Before submitting a PR, ensure:

- [ ] No hardcoded secrets, API keys, or private keys
- [ ] Input validation for all user inputs
- [ ] Authorization checks for sensitive operations
- [ ] Error messages don't leak sensitive information
- [ ] Dependencies are up to date
- [ ] Tests cover security-critical code paths
- [ ] Documentation updated for security-relevant changes
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] CORS is properly configured
- [ ] Rate limiting is implemented
- [ ] Encryption is used for sensitive data
- [ ] Access control is enforced
- [ ] Audit logs for critical operations

## Known Security Considerations

### Smart Contract Risks

#### Reentrancy
- All state changes occur before external calls
- Use the checks-effects-interactions pattern
- Soroban's host environment provides protection against reentrancy

#### Integer Overflow/Underflow
- Use `checked_add`, `checked_sub`, `checked_mul` for arithmetic
- Validate all numeric inputs

#### Access Control
- Always verify caller authorization with `require_auth()`
- Implement role-based access control where appropriate
- Validate credential ownership before operations

#### Time Dependence
- Be aware that `env.ledger().timestamp()` can be manipulated by validators
- Don't rely on exact timestamps for critical security decisions
- Use block numbers for time-based logic when possible

### Backend Risks

#### Authentication/Authorization
- JWT tokens stored securely (httpOnly cookies)
- Token expiration and refresh mechanisms implemented
- Role-based access control enforced
- Wallet signature verification for sensitive operations

#### Data Protection
- Health credentials encrypted at rest using AES-256
- Encryption keys stored in secure key management service
- TLS 1.3 enforced for all communications
- Regular security audits of encryption implementation

#### API Security
- Rate limiting on all endpoints
- Input validation and sanitization
- SQL injection prevention with parameterized queries
- CORS properly configured
- API keys rotated regularly

### Frontend Risks

#### XSS (Cross-Site Scripting)
- All user input sanitized with DOMPurify
- React's built-in XSS protection utilized
- Content Security Policy headers implemented

#### CSRF (Cross-Site Request Forgery)
- CSRF tokens for state-changing operations
- SameSite cookie attribute set
- Origin validation on backend

#### Wallet Integration
- Verify all transaction details before signing
- Display clear warnings for sensitive operations
- Implement transaction simulation before execution

## Encryption Standards

### Data at Rest
- **Algorithm**: AES-256-GCM
- **Key Management**: AWS KMS / HashiCorp Vault
- **Key Rotation**: Every 90 days
- **Backup Encryption**: Separate encryption key

### Data in Transit
- **Protocol**: TLS 1.3
- **Certificate**: Let's Encrypt / DigiCert
- **Cipher Suites**: Only strong ciphers enabled
- **HSTS**: Enabled with max-age=31536000

### Health Credential Storage
- **IPFS**: Encrypted before upload with user's public key
- **On-Chain**: Only credential hash and metadata stored
- **Zero-Knowledge Proofs**: No raw health data revealed

## Security Audits

### Planned Audits
- Smart contract security audit by [Audit Firm] - Q3 2026
- Backend penetration testing - Q4 2026
- Zero-knowledge proof verification - Q1 2027

### Past Audits
- None yet (new project)

## Compliance

### Healthcare Regulations
- **HIPAA Compliance**: Encryption, access controls, audit logs
- **GDPR Compliance**: User data rights, data portability, right to erasure
- **HITECH Act**: Electronic health record security

### Security Standards
- **OWASP Top 10**: All vulnerabilities addressed
- **CWE Top 25**: Dangerous software weaknesses mitigated
- **NIST Cybersecurity Framework**: Risk management alignment

## Incident Response Plan

### Detection
- Automated monitoring with Sentry, Datadog
- Smart contract event monitoring
- Unusual activity alerts

### Response Process
1. **Identify**: Confirm security incident
2. **Contain**: Isolate affected systems
3. **Eradicate**: Remove threat and vulnerabilities
4. **Recover**: Restore systems to normal operation
5. **Learn**: Post-incident analysis and improvements

### Communication
- Users notified within 72 hours for data breaches
- Public disclosure after fix is deployed
- Transparency report published quarterly

## Security Resources

### Documentation
- [Soroban Security Best Practices](https://soroban.stellar.org/docs/learn/security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Stellar Security Guide](https://developers.stellar.org/docs/learn/security)

### Tools
- **Smart Contract Analysis**: Soroban CLI, Rust Analyzer
- **Dependency Scanning**: Dependabot, Snyk
- **SAST**: SonarQube, Semgrep
- **DAST**: OWASP ZAP, Burp Suite

### Training
- Regular security training for all contributors
- Smart contract security workshops
- Incident response drills

## Responsible Disclosure Examples

### Good Report
```
Title: Credential Sharing Access Control Bypass

Description: An attacker can access shared health credentials after 
the sharing period has expired due to missing expiration validation 
in the verification endpoint.

Steps to Reproduce:
1. User A shares credential with User B for 24 hours
2. Wait 25 hours for sharing to expire
3. User B can still access the credential via /api/v1/verification/:id

Impact: Unauthorized access to expired health credentials, privacy violation

Suggested Fix: Add expiration time validation in verification middleware

Proof of Concept: [code snippet]
```

### Poor Report
```
Title: Security bug

Description: Your website is vulnerable

Steps: Just hack it

Impact: Bad
```

## Contact

For security-related questions or concerns:
- **Email**: security@validfi.io
- **GitHub**: https://github.com/GuardZero144/ValidFi/security
- **Discord**: [Security channel on Discord]

---

**Last Updated**: June 2026  
**Version**: 1.0.0

Thank you for helping keep ValidFi and its users safe!
