#!/usr/bin/env python3
"""Rebuild only the public expired-certificate CMS fixtures for STR-423.

Requires Python cryptography 46.0.5 (Apache-2.0 OR BSD-3-Clause). Keys are
ephemeral and never written to disk; fixture signatures differ on regeneration.
Use the existing inner.pdf as independent expected extraction bytes.
"""
from datetime import datetime, timezone
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs7
from cryptography.x509.oid import NameOID


def main() -> None:
    folder = Path(__file__).resolve().parent
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, "STR-423 synthetic expired signer"),
    ])
    certificate = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(423176)
        .not_valid_before(datetime(2018, 1, 1, tzinfo=timezone.utc))
        .not_valid_after(datetime(2020, 1, 1, tzinfo=timezone.utc))
        .sign(key, hashes.SHA256())
    )
    envelope = (
        pkcs7.PKCS7SignatureBuilder()
        .set_data((folder / "inner.pdf").read_bytes())
        .add_signer(certificate, key, hashes.SHA256())
        .sign(serialization.Encoding.DER, [pkcs7.PKCS7Options.Binary])
    )
    (folder / "documento-scaduto.p7m").write_bytes(envelope)
    (folder / "cert-scaduto.pem").write_bytes(
        certificate.public_bytes(serialization.Encoding.PEM)
    )


if __name__ == "__main__":
    main()
