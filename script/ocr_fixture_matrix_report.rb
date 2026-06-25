#!/usr/bin/env ruby
require "json"
require "shellwords"

log = File.read(ENV.fetch("LOG_FILE"))
verify_status = Integer(ENV.fetch("VERIFY_STATUS", "0"))
mode = ENV.fetch("OUTPUT_FORMAT")
export_dir = ENV.fetch("EXPORT_DIR", "")
complete = log.include?("✅ PASS: Real fixture strict coverage requirements")

missing_line = log.lines.find do |line|
  line.include?("Missing strict fixture coverage:") ||
    line.include?("Real fixture strict coverage missing")
end

missing = []
if missing_line
  missing_text = missing_line
    .sub(/^.*Missing strict fixture coverage:\s*/, "")
    .sub(/^.*Real fixture strict coverage missing\s*/, "")
    .strip
  missing = missing_text.split(/,\s*/).reject(&:empty?)
end

warnings = log.lines
  .select { |line| line.start_with?("WARNING: Fixtures with incomplete metadata:") }
  .flat_map do |line|
    line
      .sub(/^WARNING: Fixtures with incomplete metadata:\s*/, "")
      .strip
      .split(/,\s*/)
  end
  .reject(&:empty?)

targets = []
sources = %w[webcam continuity]
sides = %w[cie_front cie_back tessera_front tessera_back]
rejected_conditions = %w[tilted glare slight-blur dark-background light-background partial-frame non-document]

sources.each do |source|
  sides.each do |side|
    item = "accepted #{source} document side #{side}"
    targets << "accept #{source} #{side} good" if missing.include?(item)
  end
end

sources.each do |source|
  rejected_conditions.each do |condition|
    item = "rejected condition #{source} #{condition}"
    targets << "reject #{source} negative #{condition}" if missing.include?(item)
  end
end

next_targets =
  if !warnings.empty?
    ["fix incomplete metadata listed in incompleteMetadata"]
  elsif targets.empty? && missing.include?("at least one real fixture manifest")
    ["export and import the first redacted/test capture fixture"]
  elsif targets.empty? && !missing.empty?
    ["resolve remaining missing coverage"]
  else
    targets
  end

case mode
when "json"
  puts JSON.pretty_generate(
    status: complete ? "complete" : "incomplete",
    exitStatus: verify_status,
    missing: missing,
    incompleteMetadata: warnings,
    nextCaptureTargets: next_targets.first(12)
  )
when "next"
  if complete
    puts "complete"
  elsif next_targets.empty?
    puts "resolve verifier failure before collecting fixtures"
  else
    puts next_targets.first
  end
when "next-command"
  target = complete ? "complete" : next_targets.first
  if target.nil?
    puts "resolve verifier failure before collecting fixtures"
  elsif !target.start_with?("accept ", "reject ")
    puts target
  else
    quoted_export_dir = Shellwords.escape(export_dir)
    puts "./script/import_ocr_fixture.sh --dry-run --expect-next #{quoted_export_dir}"
    puts "./script/import_ocr_fixture.sh --expect-next #{quoted_export_dir}"
  end
else
  warn "error: unsupported output format: #{mode}"
  exit 2
end
