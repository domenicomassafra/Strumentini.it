# Gold fixtures

Expected values are independent of future production implementations. They come from small normative specification vectors, hand-worked literals, or synthetic local files.

Rules:
- never generate an expected value by calling the implementation under test;
- do not copy third-party sample corpora without explicit redistribution rights;
- locally generated binary/image fixtures contain no third-party content;
- malformed and XSS fixture payloads are inert test data and must never be executed;
- a file signature is evidence of format, never proof that content is safe;
- where no universal standard exists, a fixture states the UtilityOS product policy explicitly.
