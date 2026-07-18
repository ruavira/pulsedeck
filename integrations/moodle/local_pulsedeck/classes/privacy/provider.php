<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Privacy API provider for the PulseDeck LMS bridge receiver.
 *
 * @package   local_pulsedeck
 * @copyright 2026 Ruavira
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace local_pulsedeck\privacy;

defined('MOODLE_INTERNAL') || die();

use core_privacy\local\metadata\collection;

/**
 * Declares the participant data this plugin stores.
 */
class provider implements
    \core_privacy\local\metadata\provider {

    /**
     * Describe stored personal data.
     *
     * @param collection $collection Metadata collection.
     * @return collection
     */
    public static function get_metadata(collection $collection): collection {
        $collection->add_database_table('local_pulsedeck_result', [
            'nickname' => 'privacy:metadata:local_pulsedeck_result:nickname',
            'userid' => 'privacy:metadata:local_pulsedeck_result:userid',
            'score' => 'privacy:metadata:local_pulsedeck_result:score',
        ], 'privacy:metadata:local_pulsedeck_result');
        return $collection;
    }
}
