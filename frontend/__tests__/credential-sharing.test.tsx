import { render, screen } from '@testing-library/react';
import { CredentialSharing } from '../src/components/credential-sharing';

describe('CredentialSharing', () => {
  const walletAddress = 'GABCDEF123456...';

  it('renders the heading', () => {
    render(<CredentialSharing walletAddress={walletAddress} />);
    expect(screen.getByText('Credential Sharing')).toBeInTheDocument();
  });

  it('renders share form elements', () => {
    render(<CredentialSharing walletAddress={walletAddress} />);
    expect(screen.getByLabelText('Recipient Wallet Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Select Vaccination Credential')).toBeInTheDocument();
    expect(screen.getByLabelText('Proof Duration')).toBeInTheDocument();
  });

  it('renders empty state when no credentials shared', () => {
    render(<CredentialSharing walletAddress={walletAddress} />);
    expect(screen.getByText('No credentials shared yet')).toBeInTheDocument();
  });

  it('renders share button', () => {
    render(<CredentialSharing walletAddress={walletAddress} />);
    expect(screen.getByText('Share Vaccination Proof')).toBeInTheDocument();
  });

  it('renders duration options', () => {
    render(<CredentialSharing walletAddress={walletAddress} />);
    expect(screen.getByText('1 hour')).toBeInTheDocument();
    expect(screen.getByText('1 day')).toBeInTheDocument();
    expect(screen.getByText('1 week')).toBeInTheDocument();
    expect(screen.getByText('1 month')).toBeInTheDocument();
  });
});
