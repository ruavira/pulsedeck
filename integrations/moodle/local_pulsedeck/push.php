<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * PulseDeck LMS bridge webhook endpoint.
 *
 * Point a PulseDeck deck's "Results endpoint" at:
 *   https://YOUR-MOODLE/local/pulsedeck/push.php
 * Authentication is the HMAC signature (no Moodle session involved).
 *
 * @package   local_pulsedeck
 * @copyright 2026 Ruavira
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Webhook endpoint: no cookies, no login, HMAC is the auth.
define('NO_MOODLE_COOKIES', true);
// phpcs:ignore moodle.Files.RequireLogin.Missing
require(__DIR__ . '/../../config.php');

use local_pulsedeck\receiver;

function local_pulsedeck_respond(int $status, array $body): void {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($body);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    local_pulsedeck_respond(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

if (!get_config('local_pulsedeck', 'enabled')) {
    local_pulsedeck_respond(403, ['ok' => false, 'error' => 'disabled']);
}

$secret = (string)get_config('local_pulsedeck', 'secret');
if ($secret === '') {
    local_pulsedeck_respond(503, ['ok' => false, 'error' => 'no_secret_configured']);
}

$rawbody = file_get_contents('php://input');
if ($rawbody === false || strlen($rawbody) > 2 * 1024 * 1024) {
    local_pulsedeck_respond(413, ['ok' => false, 'error' => 'body_missing_or_too_large']);
}

$timestamp = $_SERVER['HTTP_X_PULSEDECK_TIMESTAMP'] ?? '';
$signature = $_SERVER['HTTP_X_PULSEDECK_SIGNATURE'] ?? '';
$event = $_SERVER['HTTP_X_PULSEDECK_EVENT'] ?? '';

$window = (int)get_config('local_pulsedeck', 'window');
if ($window <= 0) {
    $window = 300;
}

if (!receiver::verify_signature($secret, $timestamp, $rawbody, $signature, $window)) {
    local_pulsedeck_respond(401, ['ok' => false, 'error' => 'bad_signature']);
}

// Test pings verify wiring but store nothing.
if ($event === 'test') {
    local_pulsedeck_respond(200, ['ok' => true, 'received' => 'test']);
}

$payload = json_decode($rawbody);
if (!is_object($payload) || ($payload->event ?? '') !== 'session.results') {
    local_pulsedeck_respond(400, ['ok' => false, 'error' => 'unexpected_payload']);
}

$pushid = receiver::ingest($payload, $rawbody);
local_pulsedeck_respond(200, ['ok' => true, 'pushid' => $pushid]);
