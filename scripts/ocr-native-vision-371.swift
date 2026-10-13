// #371 — macOS-only, offline, nonproduction Vision OCR comparator.
// Build with the preinstalled Swift toolchain:
//   swiftc scripts/ocr-native-vision-371.swift -o /tmp/ocr-native-vision-371
// Invoke with a SHA-pinned, independently annotated LOCAL PNG:
//   /tmp/ocr-native-vision-371 --image PATH --expected-sha256 HEX64 \
//     --expected-text 'Reference text' --language it-IT
// No networking, downloaded language packs, OCR donor assets or production APIs.
import Foundation
import Darwin
import CryptoKit
import ImageIO
import Vision

private enum Refusal371: Error {
    case arguments, unsupportedLanguage, invalidDigest, unreadableFile
    case unsafeFile, fileTooLarge, changedInput, invalidPng, invalidDimensions
    case languageUnavailable, recognitionFailed, resultTooLong

    var code: String {
        switch self {
        case .arguments: "ARGUMENTS"
        case .unsupportedLanguage: "UNSUPPORTED_LANGUAGE"
        case .invalidDigest: "INVALID_SHA256"
        case .unreadableFile: "UNREADABLE_FILE"
        case .unsafeFile: "UNSAFE_FILE"
        case .fileTooLarge: "FILE_LIMIT"
        case .changedInput: "SOURCE_SHA256_MISMATCH"
        case .invalidPng: "INVALID_PNG"
        case .invalidDimensions: "DIMENSION_LIMIT"
        case .languageUnavailable: "LANGUAGE_NOT_INSTALLED"
        case .recognitionFailed: "VISION_RECOGNITION_FAILED"
        case .resultTooLong: "RESULT_LIMIT"
        }
    }
}

private let maximumImageBytes371 = 5 * 1024 * 1024
private let maximumPixels371 = 2_000_000
private let maximumSide371 = 5_000

private struct Arguments371 {
    let image: String
    let sha256: String
    let expected: String
    let language: String

    init(_ argv: [String]) throws {
        guard argv.count == 9 else { throw Refusal371.arguments }
        var pairs: [String: String] = [:]
        var index = 1
        while index < argv.count {
            let flag = argv[index]
            guard ["--image", "--expected-sha256", "--expected-text", "--language"].contains(flag),
                  pairs[flag] == nil else { throw Refusal371.arguments }
            pairs[flag] = argv[index + 1]
            index += 2
        }
        guard let image = pairs["--image"], !image.isEmpty,
              let sha256 = pairs["--expected-sha256"], !sha256.isEmpty,
              let expected = pairs["--expected-text"],
              !expected.isEmpty, expected.unicodeScalars.count <= 512,
              let language = pairs["--language"] else { throw Refusal371.arguments }
        guard sha256.utf8.count == 64,
              sha256.utf8.allSatisfy({ ($0 >= 48 && $0 <= 57) || ($0 >= 97 && $0 <= 102) })
        else { throw Refusal371.invalidDigest }
        guard language == "it-IT" || language == "en-US" else {
            throw Refusal371.unsupportedLanguage
        }
        self.image = image
        self.sha256 = sha256
        self.expected = expected
        self.language = language
    }
}

/// O_NONBLOCK prevents FIFO opens from hanging before fstat; O_NOFOLLOW + fstat
/// reject symlinks/non-regular objects and enforce the bounded byte count
/// *before* allocating or decoding user-controlled bytes.
private func localBytes371(path: String) throws -> Data {
    let fd = open(path, O_RDONLY | O_NONBLOCK | O_NOFOLLOW | O_CLOEXEC)
    guard fd >= 0 else { throw Refusal371.unreadableFile }
    defer { close(fd) }
    var info = stat()
    guard fstat(fd, &info) == 0 else { throw Refusal371.unreadableFile }
    guard (info.st_mode & mode_t(S_IFMT)) == mode_t(S_IFREG) else {
        throw Refusal371.unsafeFile
    }
    guard info.st_size >= 64, info.st_size <= maximumImageBytes371 else {
        throw Refusal371.fileTooLarge
    }
    let size = Int(info.st_size)
    var bytes = [UInt8](repeating: 0, count: size)
    try bytes.withUnsafeMutableBytes { destination in
        var offset = 0
        while offset < size {
            let base = destination.baseAddress!.advanced(by: offset)
            let count = Darwin.read(fd, base, size - offset)
            if count < 0 && errno == EINTR { continue }
            guard count > 0 else { throw Refusal371.unreadableFile }
            offset += count
        }
    }
    return Data(bytes)
}

private func normalized371(_ input: String) -> String {
    input.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
}

private func editDistance371<T: Equatable>(_ reference: [T], _ observed: [T]) -> Int {
    var previous = Array(0...observed.count)
    for (row, source) in reference.enumerated() {
        var current = [row + 1]
        for (column, target) in observed.enumerated() {
            current.append(min(
                current[column] + 1,
                previous[column + 1] + 1,
                previous[column] + (source == target ? 0 : 1)
            ))
        }
        previous = current
    }
    return previous[observed.count]
}

private func run371(_ options: Arguments371) throws -> [String: Any] {
    let bytes = try localBytes371(path: options.image)
    let sha = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
    guard sha == options.sha256 else { throw Refusal371.changedInput }
    guard bytes.count >= 33,
          bytes.prefix(8).elementsEqual([137, 80, 78, 71, 13, 10, 26, 10]),
          bytes[8...15].elementsEqual([0, 0, 0, 13, 73, 72, 68, 82]) else {
        throw Refusal371.invalidPng
    }
    // Inspect untrusted IHDR geometry BEFORE asking ImageIO to decompress any
    // pixels. A tiny, validly SHA-pinned PNG can still claim huge dimensions.
    func unsignedBE32(_ at: Int) -> Int {
        bytes[at..<(at + 4)].reduce(0) { ($0 << 8) | Int($1) }
    }
    let declaredWidth = unsignedBE32(16)
    let declaredHeight = unsignedBE32(20)
    guard declaredWidth > 0, declaredHeight > 0,
          declaredWidth <= maximumSide371, declaredHeight <= maximumSide371,
          declaredWidth * declaredHeight <= maximumPixels371 else {
        throw Refusal371.invalidDimensions
    }
    guard let source = CGImageSourceCreateWithData(bytes as CFData, nil),
          CGImageSourceGetCount(source) == 1,
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        throw Refusal371.invalidPng
    }
    let width = image.width
    let height = image.height
    guard width == declaredWidth, height == declaredHeight else {
        throw Refusal371.invalidPng
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = [options.language]
    request.automaticallyDetectsLanguage = false
    request.usesLanguageCorrection = false
    let supported: [String]
    do { supported = try request.supportedRecognitionLanguages() }
    catch { throw Refusal371.languageUnavailable }
    guard supported.contains(options.language) else { throw Refusal371.languageUnavailable }

    let started = DispatchTime.now().uptimeNanoseconds
    do {
        try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
    } catch { throw Refusal371.recognitionFailed }
    let elapsed = Double(DispatchTime.now().uptimeNanoseconds - started) / 1_000_000
    let observations = request.results ?? []
    let candidates = observations.compactMap { $0.topCandidates(1).first }
    let actual = normalized371(candidates.map(\.string).joined(separator: " "))
    guard actual.unicodeScalars.count <= 4_096 else { throw Refusal371.resultTooLong }
    let expected = normalized371(options.expected)
    let expectedChars = Array(expected.unicodeScalars.map(\.value))
    let actualChars = Array(actual.unicodeScalars.map(\.value))
    let expectedWords = expected.isEmpty ? [] : expected.split(separator: " ").map(String.init)
    let actualWords = actual.isEmpty ? [] : actual.split(separator: " ").map(String.init)
    let charErrors = editDistance371(expectedChars, actualChars)
    let wordErrors = editDistance371(expectedWords, actualWords)
    let meanScore = candidates.isEmpty ? nil :
        Double(candidates.map(\.confidence).reduce(0, +)) / Double(candidates.count)
    // ru_maxrss on macOS is only this process's high-water RSS (in bytes);
    // it is NOT the Vision private/XPC peak and cannot certify mobile memory.
    var usage = rusage()
    let highWaterRss = getrusage(RUSAGE_SELF, &usage) == 0 ? max(0, usage.ru_maxrss) : 0

    return [
        "ticket": 371,
        "decision": "NO_GO",
        "scope": "MACOS_VISION_LOCAL_SINGLE_HOST_SYNTHETIC_IT_ONLY",
        "engine": "Apple Vision.framework VNRecognizeTextRequest",
        "host": ["platform": "macOS", "architecture": "arm64"],
        "explicitNetworkApiCalls": 0,
        "operatingSystemNetworkEgress": "NOT_ATTESTED_BY_COMPARATOR",
        "fileSha256": sha,
        "inputBytes": bytes.count,
        "imageWidth": width,
        "imageHeight": height,
        "language": options.language,
        "recognitionLevel": "accurate",
        "automaticLanguageDetection": false,
        "languageCorrection": false,
        "referenceText": expected,
        "recognizedText": actual,
        "exact": expected == actual,
        "characterErrors": charErrors,
        "characterReferenceScalars": expectedChars.count,
        "characterErrorRate": Double(charErrors) / Double(max(1, expectedChars.count)),
        "wordErrors": wordErrors,
        "referenceWords": expectedWords.count,
        "wordErrorRate": Double(wordErrors) / Double(max(1, expectedWords.count)),
        "lineObservations": observations.count,
        "meanVisionCandidateScore": meanScore as Any? ?? NSNull(),
        "candidateScoreMeaning": "UNCALIBRATED_NATIVE_MODEL_SCORE_NOT_A_PROBABILITY",
        "recognitionMs": (elapsed * 10).rounded() / 10,
        "nativeProcessHighWaterRssBytes": highWaterRss > 0 ? highWaterRss as Any : NSNull(),
        "measuredMemory": highWaterRss > 0 ? "DARWIN_PROCESS_RUSAGE_MAXRSS_ONLY" : "NOT_MEASURED",
        "nativeVisionAndXpcPeakMemory": "NOT_MEASURED",
        "physicalIosAndroid": "NOT_RUN",
        "englishComparativeQuality": "NOT_MEASURED",
    ]
}

do {
    let args = try Arguments371(CommandLine.arguments)
    let result = try run371(args)
    let json = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
    FileHandle.standardOutput.write(json)
    FileHandle.standardOutput.write(Data([10]))
} catch {
    let code = (error as? Refusal371)?.code ?? "NATIVE_COMPARATOR_FAILED"
    fputs("OCR371_REFUSED:\(code)\n", stderr)
    exit(2)
}
