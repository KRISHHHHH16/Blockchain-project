# Verity

**Privacy-first certificate verification.** Register a certificate by its SHA-256 fingerprint, then verify that exact document in seconds. The document and personal details never go on-chain.

> The web app in this repository is a local browser demo. It does not connect to a blockchain: its demo registry lives in this browser's local storage. A separate Solidity contract is included as a starting point for deployment to an EVM network.

## Features

- Hash PDF and image certificates with the browser's native SHA-256 implementation.
- Issue credentials with a recipient, institution, and credential title.
- Verify a file or a pasted fingerprint against the local registry.
- Revoke credentials, inspect their details, and copy fingerprints.
- Export registry records as JSON and use a responsive light or dark interface.
- Keep certificate files on the device; only the hash and entered metadata are stored in local storage.

## Run locally

No build step or dependencies are required. From the project directory, run:

```bash
python -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000). A local HTTP server is required because the Web Crypto API is restricted to secure contexts. HTTPS hosting also works. Google Fonts are optional; the app falls back to system sans-serif and monospace fonts when offline.

## Use the demo

1. Fill in the recipient, institution, and credential title.
2. Select the certificate. Its SHA-256 fingerprint is computed in your browser.
3. Register the credential. The fingerprint and metadata are saved to this browser's local storage.
4. Upload the same file in the verify panel, or copy its fingerprint from the activity list and paste it in.
5. Open an activity row to inspect its record or revoke it.

An edited or different file has a different fingerprint and will not verify. Browser data can be cleared by the user or browser. Export the registry to keep a portable metadata backup.

## Smart contract

[`contracts/CertificateRegistry.sol`](contracts/CertificateRegistry.sol) is a minimal owner-managed EVM registry. It accepts `bytes32` fingerprints, emits issue and revoke events, and exposes a read-only verification method. It does not hold documents, names, or institution metadata.

The Solidity contract is not wired to the browser demo. Before a real deployment, adapt and review issuer authorization for your institution, compile and test the contract, choose and fund the target network, deploy with your selected toolchain, and implement a wallet-connected client. A public chain makes fingerprints and transaction metadata public; obtain appropriate review before registering production credentials.

## Project structure

```text
index.html                  App structure
styles.css                  Responsive interface and themes
app.js                      Hashing, local registry, issue/verify/revoke
contracts/CertificateRegistry.sol  EVM registry contract
```

## License

MIT. See [LICENSE](LICENSE).
