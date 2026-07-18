<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Admin settings for the PulseDeck LMS bridge receiver.
 *
 * @package   local_pulsedeck
 * @copyright 2026 Ruavira
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

if ($hassiteconfig) {
    $settings = new admin_settingpage('local_pulsedeck', get_string('pluginname', 'local_pulsedeck'));
    $ADMIN->add('localplugins', $settings);

    $settings->add(new admin_setting_configcheckbox(
        'local_pulsedeck/enabled',
        get_string('setting_enabled', 'local_pulsedeck'),
        get_string('setting_enabled_desc', 'local_pulsedeck'),
        0
    ));

    $settings->add(new admin_setting_configpasswordunmask(
        'local_pulsedeck/secret',
        get_string('setting_secret', 'local_pulsedeck'),
        get_string('setting_secret_desc', 'local_pulsedeck'),
        ''
    ));

    $settings->add(new admin_setting_configduration(
        'local_pulsedeck/window',
        get_string('setting_window', 'local_pulsedeck'),
        get_string('setting_window_desc', 'local_pulsedeck'),
        300
    ));
}
