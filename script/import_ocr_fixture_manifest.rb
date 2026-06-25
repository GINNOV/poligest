#!/usr/bin/env ruby
require "json"
require "pathname"

ALLOWED_CONDITIONS = %w[
  good
  tilted
  glare
  slight-blur
  dark-background
  light-background
  partial-frame
  non-document
].freeze
CAMERA_SOURCES = %w[webcam continuity].freeze

def replay_only?(fixture)
  fixture["replayOnly"] == true
end

def read_manifest
  JSON.parse(File.read(ENV.fetch("MANIFEST")))
rescue JSON::ParserError => e
  warn "error: manifest.json is not valid JSON: #{e.message}"
  exit 1
end

def computed_target(fixture)
  [
    fixture.fetch("expect", "accept"),
    fixture.fetch("captureSource", "unknown"),
    fixture.fetch("documentSide", "unknown"),
    fixture.fetch("condition", "unspecified")
  ].join(" ")
end

def fixture_target(fixture)
  explicit = fixture["matrixTarget"].to_s.strip
  explicit.empty? ? computed_target(fixture) : explicit
end

def each_fixture(manifest)
  fixtures = manifest["fixtures"]
  unless fixtures.is_a?(Array) && !fixtures.empty?
    warn "error: manifest.json must contain a non-empty fixtures array"
    exit 1
  end
  fixtures.each_with_index { |fixture, index| yield fixture, index + 1 }
end

def validate_fixture_metadata(fixture, number)
  expect = fixture.fetch("expect", "accept").to_s.strip
  capture_source = fixture.fetch("captureSource", "unknown").to_s.strip
  document_side = fixture.fetch("documentSide", "unknown").to_s.strip
  condition = fixture.fetch("condition", "unspecified").to_s.strip

  unless %w[accept reject].include?(expect)
    warn "error: fixture #{number} expect must be accept or reject"
    exit 1
  end

  unless ALLOWED_CONDITIONS.include?(condition)
    warn "error: fixture #{number} condition must be one of: #{ALLOWED_CONDITIONS.join(", ")}"
    exit 1
  end

  if expect == "accept" && condition != "good"
    warn "error: fixture #{number} accepted fixtures must use condition good"
    exit 1
  end

  if expect == "reject" && condition == "good"
    warn "error: fixture #{number} rejected fixtures must not use condition good"
    exit 1
  end

  if expect == "accept" && document_side == "negative"
    warn "error: fixture #{number} accepted fixtures must name the document side, not negative"
    exit 1
  end

  if expect == "reject" && CAMERA_SOURCES.include?(capture_source) && document_side != "negative"
    warn "error: fixture #{number} rejected camera fixtures must use documentSide negative"
    exit 1
  end

  if CAMERA_SOURCES.include?(capture_source) && fixture["ocrProvider"].to_s.strip.empty?
    warn "error: fixture #{number} camera fixtures must declare ocrProvider"
    exit 1
  end

  if replay_only?(fixture) && fixture["image"].to_s.strip != ""
    warn "error: fixture #{number} replay-only fixtures must not declare an image path"
    exit 1
  end

  if replay_only?(fixture) && fixture.key?("orientation")
    warn "error: fixture #{number} replay-only fixtures must not declare orientation metadata"
    exit 1
  end
end

def validate_image_path(fixture, number, source_dir)
  return if replay_only?(fixture) && fixture["image"].to_s.strip.empty?

  image = fixture["image"]
  unless image.is_a?(String) && !image.strip.empty?
    warn "error: fixture #{number} must declare an image path"
    exit 1
  end

  image_path = Pathname.new(image)
  if image_path.absolute? || image_path.each_filename.any? { |part| part == ".." }
    warn "error: fixture #{number} image path must stay inside the exported folder: #{image}"
    exit 1
  end

  candidate = (source_dir + image).cleanpath
  unless candidate.to_s.start_with?(source_dir.to_s + File::SEPARATOR) && candidate.file?
    warn "error: fixture #{number} image file is missing: #{image}"
    exit 1
  end

  real_candidate = candidate.realpath
  unless real_candidate.to_s.start_with?(source_dir.to_s + File::SEPARATOR)
    warn "error: fixture #{number} image file must resolve inside the exported folder: #{image}"
    exit 1
  end
end

def validate_matrix_target(fixture, number, manifest_targets)
  explicit = fixture["matrixTarget"].to_s.strip
  target = fixture_target(fixture)
  manifest_targets << target

  return if explicit.empty? || explicit == computed_target(fixture)

  warn "error: fixture #{number} matrixTarget mismatch: expected '#{computed_target(fixture)}', got '#{explicit}'"
  exit 1
end

def validate_manifest(manifest)
  source_dir = Pathname.new(ENV.fetch("SOURCE_DIR")).realpath
  expected_target = ENV.fetch("EXPECTED_TARGET").strip
  manifest_targets = []

  each_fixture(manifest) do |fixture, number|
    validate_fixture_metadata(fixture, number)
    validate_image_path(fixture, number, source_dir)
    validate_matrix_target(fixture, number, manifest_targets)
  end

  return if expected_target.empty? || manifest_targets.include?(expected_target)

  warn "error: expected matrix target '#{expected_target}' not found in exported fixture"
  warn "fixture matrix targets: #{manifest_targets.join(", ")}"
  exit 1
end

def print_targets(manifest)
  puts "Matrix targets:"
  each_fixture(manifest) { |fixture, _number| puts "- #{fixture_target(fixture)}" }
end

mode = ARGV.fetch(0, "")
manifest = read_manifest

case mode
when "validate"
  validate_manifest(manifest)
when "targets"
  print_targets(manifest)
else
  warn "error: unsupported import manifest mode: #{mode}"
  exit 2
end
