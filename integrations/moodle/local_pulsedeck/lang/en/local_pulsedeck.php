<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * English strings for the PulseDeck LMS bridge receiver.
 *
 * @package   local_pulsedeck
 * @copyright 2026 Ruavira
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$string['pluginname'] = 'PulseDeck bridge';
$string['privacy:metadata:local_pulsedeck_result'] = 'Participant results received from PulseDeck live sessions.';
$string['privacy:metadata:local_pulsedeck_result:nickname'] = 'The nickname the participant used in the live session.';
$string['privacy:metadata:local_pulsedeck_result:userid'] = 'The Moodle user matched to the nickname, when a unique match exists.';
$string['privacy:metadata:local_pulsedeck_result:score'] = 'The participant\'s quiz score.';

$string['setting_enabled'] = 'Accept pushes';
$string['setting_enabled_desc'] = 'When off, the endpoint rejects every request (403).';
$string['setting_secret'] = 'Signing secret';
$string['setting_secret_desc'] = 'Must match the secret configured in the PulseDeck deck\'s LMS bridge settings. Pushes are verified with HMAC-SHA256.';
$string['setting_window'] = 'Freshness window';
$string['setting_window_desc'] = 'Reject pushes whose timestamp is older than this (replay protection).';

$string['report'] = 'PulseDeck session results';
$string['nopushes'] = 'No results received yet. Configure a deck\'s LMS bridge in PulseDeck to point at {$a}local/pulsedeck/push.php and run a session.';
$string['pushmeta'] = 'Ended {$a->when} · {$a->count} participants';
$string['downloadcsv'] = 'Download CSV';
$string['backtolist'] = 'All sessions';
$string['view'] = 'View';
$string['col_when'] = 'When';
$string['col_deck'] = 'Deck';
$string['col_code'] = 'Join code';
$string['col_participants'] = 'Participants';
$string['col_nickname'] = 'Nickname';
$string['col_user'] = 'Matched user';
$string['col_score'] = 'Score';
$string['col_quiz'] = 'Quiz (correct/attempts)';
$string['col_completion'] = 'Completion';
$string['pulsedeck:viewreport'] = 'View PulseDeck session results';
