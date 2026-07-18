<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Webhook verification + ingestion for the PulseDeck LMS bridge.
 *
 * @package   local_pulsedeck
 * @copyright 2026 Ruavira
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace local_pulsedeck;

defined('MOODLE_INTERNAL') || die();

/**
 * Verifies X-PulseDeck-Signature headers and stores session.results payloads.
 */
class receiver {

    /**
     * Constant-time verification of the PulseDeck HMAC signature.
     *
     * The signature is HMAC-SHA256 over "<timestamp>.<raw body>" using the
     * shared secret, sent as "sha256=<hex>" in X-PulseDeck-Signature.
     *
     * @param string $secret Shared secret configured on both sides.
     * @param string $timestamp Value of X-PulseDeck-Timestamp (unix ms).
     * @param string $body Raw request body.
     * @param string $signature Value of X-PulseDeck-Signature.
     * @param int $windowseconds Freshness window (replay protection).
     * @param int|null $nowms Current unix time in ms (injectable for tests).
     * @return bool
     */
    public static function verify_signature(
        string $secret,
        string $timestamp,
        string $body,
        string $signature,
        int $windowseconds = 300,
        ?int $nowms = null
    ): bool {
        if ($secret === '' || $timestamp === '' || $signature === '') {
            return false;
        }
        if (!preg_match('/^\d{10,16}$/', $timestamp)) {
            return false;
        }
        $nowms = $nowms ?? (int)floor(microtime(true) * 1000);
        if (abs($nowms - (float)$timestamp) > $windowseconds * 1000) {
            return false;
        }
        $expected = hash_hmac('sha256', $timestamp . '.' . $body, $secret);
        $given = str_ireplace('sha256=', '', trim($signature));
        return hash_equals($expected, $given);
    }

    /**
     * Store a decoded session.results payload. Returns the push record id.
     *
     * Participants whose nickname exactly matches one active Moodle username
     * or email (case-insensitive, unique match only) are linked via userid so
     * reports and future grade sync can attribute results.
     *
     * @param \stdClass $payload Decoded JSON payload.
     * @param string $rawbody Raw JSON (kept for audit).
     * @return int push id
     */
    public static function ingest(\stdClass $payload, string $rawbody): int {
        global $DB;

        $now = time();
        $session = $payload->session ?? new \stdClass();

        $push = new \stdClass();
        $push->event = substr((string)($payload->event ?? 'unknown'), 0, 40);
        $push->sessionid = substr((string)($session->id ?? ''), 0, 36);
        $push->deckid = substr((string)($session->deckId ?? ''), 0, 36);
        $push->decktitle = substr((string)($session->deckTitle ?? ''), 0, 255);
        $push->code = substr((string)($session->code ?? ''), 0, 12);
        $push->startedat = self::iso_to_unix($session->startedAt ?? null);
        $push->endedat = self::iso_to_unix($session->endedAt ?? null);
        $push->participantcount = (int)($session->participantCount ?? 0);
        $push->rawpayload = $rawbody;
        $push->timecreated = $now;
        $pushid = $DB->insert_record('local_pulsedeck_push', $push);

        foreach ((array)($payload->participants ?? []) as $p) {
            $row = new \stdClass();
            $row->pushid = $pushid;
            $row->nickname = substr((string)($p->nickname ?? 'Anonymous'), 0, 100);
            $row->userid = self::match_user($row->nickname);
            $row->score = (int)($p->score ?? 0);
            $row->beststreak = (int)($p->bestStreak ?? 0);
            $row->quizattempts = (int)($p->quizAttempts ?? 0);
            $row->quizcorrect = (int)($p->quizCorrect ?? 0);
            $row->completionpct = (int)round(((float)($p->completion ?? 0)) * 100);
            $row->timecreated = $now;
            $DB->insert_record('local_pulsedeck_result', $row);
        }

        return $pushid;
    }

    /**
     * Best-effort nickname -> Moodle user match (unique username or email).
     *
     * @param string $nickname Participant nickname.
     * @return int user id, or 0 when no unique match exists.
     */
    protected static function match_user(string $nickname): int {
        global $DB;

        $needle = \core_text::strtolower(trim($nickname));
        if ($needle === '' || $needle === 'anonymous') {
            return 0;
        }
        $users = $DB->get_records_select(
            'user',
            "deleted = 0 AND suspended = 0 AND (LOWER(username) = :u OR LOWER(email) = :e)",
            ['u' => $needle, 'e' => $needle],
            '',
            'id',
            0,
            2
        );
        return count($users) === 1 ? (int)array_key_first($users) : 0;
    }

    /**
     * ISO-8601 string to unix seconds (null-safe).
     *
     * @param mixed $iso ISO timestamp or null.
     * @return int|null
     */
    protected static function iso_to_unix($iso): ?int {
        if (!is_string($iso) || $iso === '') {
            return null;
        }
        $t = strtotime($iso);
        return $t === false ? null : $t;
    }
}
