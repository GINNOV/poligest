#!/usr/bin/env ruby
require "fileutils"
require "json"

SYNTHETIC_IDENTITY = {
  "surname" => "ROSSI",
  "name" => "LUCA",
  "codiceFiscale" => "RSSLCU90A15H501A",
  "dateOfBirth" => "15/01/1990",
  "placeOfBirth" => "ROMA",
  "gender" => "M",
  "expiryDate" => "31/12/2030",
  "documentNumber" => "CA12345AA",
  "cardNumber" => "80380000000000012345",
}.freeze

REDACTABLE_FIELDS = SYNTHETIC_IDENTITY.keys.freeze

def usage
  warn "usage: #{$PROGRAM_NAME} <exported-fixture-dir> <output-dir>"
end

def read_manifest(source_dir)
  path = File.join(source_dir, "manifest.json")
  JSON.parse(File.read(path))
rescue Errno::ENOENT
  warn "error: exported fixture directory must contain manifest.json"
  exit 1
rescue JSON::ParserError => e
  warn "error: manifest.json is not valid JSON: #{e.message}"
  exit 1
end

def each_fixture(manifest)
  fixtures = manifest["fixtures"]
  unless fixtures.is_a?(Array) && !fixtures.empty?
    warn "error: manifest.json must contain a non-empty fixtures array"
    exit 1
  end
  fixtures.each { |fixture| yield fixture }
end

def field_replacements(fixture)
  replacements = {}
  %w[expected observed].each do |section|
    data = fixture[section]
    next unless data.is_a?(Hash)

    REDACTABLE_FIELDS.each do |field|
      original = data[field]
      replacement = SYNTHETIC_IDENTITY[field]
      next unless original.is_a?(String) && !original.empty? && replacement

      replacements[original] = replacement
    end
  end
  replacements
end

def redact_data_section(data)
  return unless data.is_a?(Hash)

  REDACTABLE_FIELDS.each do |field|
    next unless data[field].is_a?(String)

    data[field] = SYNTHETIC_IDENTITY.fetch(field)
  end
end

def redact_text(text, replacements)
  return text unless text.is_a?(String)

  redacted = text.dup
  replacements.each do |original, replacement|
    next if original.length < 3

    redacted = redacted.gsub(original, replacement)
  end
  redacted
end

def redact_observed_items(items, replacements)
  return unless items.is_a?(Array)

  items.each_with_index do |item, index|
    next unless item.is_a?(Hash)

    text = item["text"]
    if text == replacements.key(SYNTHETIC_IDENTITY["gender"])
      item["text"] = SYNTHETIC_IDENTITY["gender"]
    elsif text.is_a?(String) && text.match?(/\A[A-Z]{2}\z/) && previous_item_mentions_province?(items, index)
      item["text"] = "RM"
    else
      item["text"] = redact_text(text, replacements)
    end
  end
end

def previous_item_mentions_province?(items, index)
  return false if index.zero?

  previous = items[index - 1]
  previous.is_a?(Hash) && previous["text"].to_s.downcase.include?("provincia")
end

def redact_barcodes(barcodes, replacements)
  return unless barcodes.is_a?(Array)

  barcodes.each do |barcode|
    next unless barcode.is_a?(Hash)

    barcode["payload"] = redact_text(barcode["payload"], replacements)
  end
end

def redact_fixture(fixture)
  replacements = field_replacements(fixture)
  fixture["name"] = "#{fixture.fetch("name", "fixture")}-replay-redacted"
  fixture["replayOnly"] = true
  fixture.delete("image")
  fixture.delete("orientation")
  redact_data_section(fixture["expected"])
  redact_data_section(fixture["observed"])
  redact_observed_items(fixture["observedItems"], replacements)
  redact_barcodes(fixture["observedBarcodes"], replacements)
end

def write_manifest(manifest, output_dir)
  FileUtils.mkdir_p(output_dir)
  File.write(
    File.join(output_dir, "manifest.json"),
    "#{JSON.pretty_generate(manifest)}\n"
  )
end

if ARGV.length != 2
  usage
  exit 2
end

source_dir = ARGV.fetch(0)
output_dir = ARGV.fetch(1)
unless Dir.exist?(source_dir)
  warn "error: exported fixture directory not found: #{source_dir}"
  exit 1
end

manifest = read_manifest(source_dir)
each_fixture(manifest) { |fixture| redact_fixture(fixture) }
write_manifest(manifest, output_dir)
puts "Wrote replay-only redacted fixture: #{output_dir}"
