/*
 * Copyright (C) 2023 Red Hat, Inc.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with This program; If not, see <http://www.gnu.org/licenses/>.
 */

import React, { useState, useEffect } from "react";

import {
    Checkbox,
    TextContent,
    TextInput,
} from "@patternfly/react-core";

import { ListingTable } from "cockpit-components-table.jsx";

import cockpit from "cockpit";

import { AnacondaPage } from "../AnacondaPage.jsx";

import {
    createPartitioning,
    gatherRequests,
} from "../../apis/storage.js";

const _ = cockpit.gettext;

export const CustomMountPoint = ({ idPrefix, setIsFormValid }) => {
    const [requests, setRequests] = useState(null);
    useEffect(() => {
        if (requests === null) {
            // TODO: don't always create a new partitioning...
            createPartitioning({ method: "MANUAL" }).then(res => {
                const partitioning = res[0];
                console.log(partitioning);
                return gatherRequests(partitioning);
            })
                    .then(res => {
                        console.log("storage", res[0]);
                        setRequests(res[0]);
                    })
                    .fail(exc => console.error("exc", exc));
        }
    });

    const renderRow = row => {
        return {
            props: { key: row["device-spec"].v },
            columns: [
                { title: row["device-spec"].v },
                { title: row["format-type"].v },
                { title: <TextInput value={row["mount-point"].v} type="text" onChange={value => console.log(value)} /> },
                { title: <Checkbox label="" isChecked={row.reformat.v} onChange={() => console.log("reformat")} id="id1" /> },
            ],
        };
    };

    const columnTitles = [
        { title: _("Device") },
        { title: _("Format type") },
        { title: _("Mount point") },
        { title: _("Reformat") },
    ];

    let imageRows = [];
    if (requests !== null) {
        imageRows = requests.map(row => renderRow(row));
    }

    return (
        <AnacondaPage title={_("Select a custom mount point")}>
            <TextContent>
                {_("Some explainer about how one should partition.")}
            </TextContent>
            <ListingTable
              aria-label={_("Partitions")}
              emptyCaption={_("No partitions")}
              columns={columnTitles}
              rows={imageRows} />
        </AnacondaPage>
    );
};
