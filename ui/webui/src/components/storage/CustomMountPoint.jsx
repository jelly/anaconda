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
    Alert,
    Checkbox,
    Flex,
    HelperText,
    HelperTextItem,
    Popover,
    Select,
    SelectOption,
    SelectVariant,
    TextContent,
} from "@patternfly/react-core";
import { HelpIcon } from "@patternfly/react-icons";

import { ListingTable } from "cockpit-components-table.jsx";

import cockpit from "cockpit";

import { AnacondaPage } from "../AnacondaPage.jsx";

import {
    gatherRequests,
    setManualPartitioningRequests,
    findPartitioning,
} from "../../apis/storage.js";

import "./CustomMountPoint.scss";

const _ = cockpit.gettext;

const MountPointSelect = ({ partition, requests, mountpoint, handleOnSelect }) => {
    // TODO: extend?
    const defaultOptions = [
        { value: "/" },
        { value: "/boot" },
        { value: "/home" },
    ];

    const duplicatedMountPoint = mountpoint => {
        return requests.filter(r => r["mount-point"] === mountpoint).length > 1;
    };

    const [isOpen, setIsOpen] = useState(false);
    // Filter selected
    const options = defaultOptions.filter(val => val.value !== mountpoint);
    if (mountpoint !== "") {
        options.push({ value: mountpoint });
    }

    return (
        <Flex direction={{ default: "column" }} spaceItems={{ default: "spaceItemsNone" }}>
            <Select
              variant={SelectVariant.typeahead}
              className="mountpoint-select"
              typeAheadAriaLabel={_("Select a mountpoint")}
              selections={mountpoint || null}
              isOpen={isOpen}
              onToggle={isOpen => setIsOpen(isOpen)}
              onSelect={(_evt, selection, _) => { setIsOpen(false); handleOnSelect(selection, partition) }}
              isCreatable
              shouldResetOnSelect
            >
                {options.map((option, index) => (
                    <SelectOption
                      key={index}
                      value={option.value}
                    />
                ))}
            </Select>
            {duplicatedMountPoint(mountpoint) &&
                <HelperText component="ul">
                    <HelperTextItem variant="error" hasIcon component="li">
                        {_("Duplicate mount point.")}
                    </HelperTextItem>
                </HelperText>}
        </Flex>
    );
};

const MountpointCheckbox = ({ reformat, isRootMountPoint, handleCheckReFormat, partition }) => {
    return (
        <Flex>
            <Checkbox
              label={_("Format")}
              isChecked={reformat}
              isDisabled={isRootMountPoint}
              onChange={(checked, _) => handleCheckReFormat(checked, partition)}
              id={partition}
            />
            {isRootMountPoint &&
                <Popover
                  bodyContent={_("The root partition is always re-formatted by the installer.")}
                  showClose={false}>
                    <HelpIcon />
                </Popover>}
        </Flex>
    );
};

export const CustomMountPoint = ({ idPrefix, setIsFormValid, onAddErrorNotification, toggleContextHelp, stepNotification, isInProgress }) => {
    // [{ device-spec, format-type, mount-point, reformat }]
    const [requests, setRequests] = useState(null);
    const [partitioning, setPartitioning] = useState(null);

    useEffect(() => {
        if (requests === null) {
            findPartitioning({ method: "MANUAL" }).then(([partitioning]) => {
                setPartitioning(partitioning);
                return gatherRequests(partitioning);
            })
                    .then(([res]) => {
                        setRequests(res.map(row => {
                            return {
                                "device-spec": row["device-spec"].v,
                                "format-type": row["format-type"].v,
                                "mount-point": row["mount-point"].v,
                                reformat: row.reformat.v
                            };
                        }));
                    })
                    .fail(exc => console.error(exc));
        }
    });

    const requestsToDbus = requests => {
        return requests.map(row => {
            return {
                "device-spec": { t: "s", v: row["device-spec"] },
                "format-type": { t: "s", v: row["format-type"] },
                "mount-point": { t: "s", v: row["mount-point"] },
                reformat: { t: "b", v: row.reformat },
            };
        });
    };

    const handleOnSelect = (selection, device) => {
        setRequests(prevState => {
            return prevState.map(row => {
                if (row["device-spec"] === device) {
                    // Reset reformat option when changing from /
                    if (row["mount-point"] === "/" && selection !== row["mount-point"] && row.reformat) {
                        row.reformat = false;
                    }

                    // Always reformat the root partition
                    if (selection === "/") {
                        row.reformat = true;
                    }

                    row["mount-point"] = selection;
                }
                return row;
            });
        });
        setManualPartitioningRequests({ partitioning, requests: requestsToDbus(requests) }).catch(onAddErrorNotification);
    };

    const handleCheckReFormat = (checked, mountpoint) => {
        setRequests(prevState => {
            return prevState.map(row => {
                if (row["device-spec"] === mountpoint) {
                    row.reformat = checked;
                }
                return row;
            });
        });
        setManualPartitioningRequests({ partitioning, requests: requestsToDbus(requests) }).catch(onAddErrorNotification);
    };

    const renderRow = row => {
        const isRootMountPoint = row["mount-point"] === "/";
        return {
            props: { key: row["device-spec"] },
            columns: [
                { title: row["device-spec"] },
                { title: row["format-type"] },
                { title: <MountPointSelect requests={requests} partition={row["device-spec"]} mountpoint={row["mount-point"]} handleOnSelect={handleOnSelect} /> },
                { title: <MountpointCheckbox reformat={row.reformat} isRootMountPoint={isRootMountPoint} partition={row["device-spec"]} handleCheckReFormat={handleCheckReFormat} /> },
            ],
        };
    };

    const columnTitles = [
        { title: _("Partition") },
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
            {stepNotification && (stepNotification.step === "custom-mountpoint") &&
                <Alert
                  isInline
                  title={stepNotification.message}
                  variant="danger"
                />}
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
