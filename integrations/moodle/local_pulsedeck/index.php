<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * PulseDeck results report: received sessions, participant results, CSV export.
 *
 * @package   local_pulsedeck
 * @copyright 2026 Ruavira
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require(__DIR__ . '/../../config.php');

require_login();
$context = context_system::instance();
require_capability('local/pulsedeck:viewreport', $context);

$pushid = optional_param('id', 0, PARAM_INT);
$download = optional_param('download', 0, PARAM_BOOL);

$PAGE->set_context($context);
$PAGE->set_url(new moodle_url('/local/pulsedeck/index.php', $pushid ? ['id' => $pushid] : []));
$PAGE->set_title(get_string('report', 'local_pulsedeck'));
$PAGE->set_heading(get_string('report', 'local_pulsedeck'));

if ($pushid) {
    $push = $DB->get_record('local_pulsedeck_push', ['id' => $pushid], '*', MUST_EXIST);
    $results = $DB->get_records('local_pulsedeck_result', ['pushid' => $pushid], 'score DESC');

    if ($download) {
        // Simple CSV suited to Moodle's grade import (nickname/user, values).
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="pulsedeck-' . $push->code . '-results.csv"');
        $out = fopen('php://output', 'w');
        fputcsv($out, ['nickname', 'matched_username', 'score', 'best_streak', 'quiz_attempts', 'quiz_correct', 'completion_pct']);
        foreach ($results as $r) {
            $username = '';
            if ($r->userid && ($u = core_user::get_user($r->userid))) {
                $username = $u->username;
            }
            fputcsv($out, [$r->nickname, $username, $r->score, $r->beststreak, $r->quizattempts, $r->quizcorrect, $r->completionpct]);
        }
        fclose($out);
        exit;
    }

    echo $OUTPUT->header();
    echo $OUTPUT->heading(format_string($push->decktitle) . ' — ' . s($push->code));
    echo html_writer::tag('p',
        get_string('pushmeta', 'local_pulsedeck', (object)[
            'when' => userdate($push->endedat ?: $push->timecreated),
            'count' => $push->participantcount,
        ])
    );

    $table = new html_table();
    $table->head = [
        get_string('col_nickname', 'local_pulsedeck'),
        get_string('col_user', 'local_pulsedeck'),
        get_string('col_score', 'local_pulsedeck'),
        get_string('col_quiz', 'local_pulsedeck'),
        get_string('col_completion', 'local_pulsedeck'),
    ];
    foreach ($results as $r) {
        $user = '-';
        if ($r->userid && ($u = core_user::get_user($r->userid))) {
            $user = html_writer::link(new moodle_url('/user/profile.php', ['id' => $u->id]), fullname($u));
        }
        $quiz = $r->quizattempts > 0 ? "{$r->quizcorrect}/{$r->quizattempts}" : '-';
        $table->data[] = [s($r->nickname), $user, $r->score, $quiz, $r->completionpct . '%'];
    }
    echo html_writer::table($table);

    echo $OUTPUT->single_button(
        new moodle_url('/local/pulsedeck/index.php', ['id' => $pushid, 'download' => 1]),
        get_string('downloadcsv', 'local_pulsedeck'),
        'get'
    );
    echo $OUTPUT->single_button(
        new moodle_url('/local/pulsedeck/index.php'),
        get_string('backtolist', 'local_pulsedeck'),
        'get'
    );
    echo $OUTPUT->footer();
    exit;
}

echo $OUTPUT->header();
echo $OUTPUT->heading(get_string('report', 'local_pulsedeck'));

$pushes = $DB->get_records('local_pulsedeck_push', null, 'timecreated DESC', '*', 0, 100);
if (!$pushes) {
    echo $OUTPUT->notification(get_string('nopushes', 'local_pulsedeck'), 'info');
} else {
    $table = new html_table();
    $table->head = [
        get_string('col_when', 'local_pulsedeck'),
        get_string('col_deck', 'local_pulsedeck'),
        get_string('col_code', 'local_pulsedeck'),
        get_string('col_participants', 'local_pulsedeck'),
        '',
    ];
    foreach ($pushes as $p) {
        $table->data[] = [
            userdate($p->endedat ?: $p->timecreated),
            format_string($p->decktitle),
            s($p->code),
            $p->participantcount,
            html_writer::link(
                new moodle_url('/local/pulsedeck/index.php', ['id' => $p->id]),
                get_string('view', 'local_pulsedeck')
            ),
        ];
    }
    echo html_writer::table($table);
}
echo $OUTPUT->footer();
