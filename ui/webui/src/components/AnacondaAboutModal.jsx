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
import cockpit from "cockpit";

import React from "react";

import {
    AboutModal,
    TextContent,
    TextList,
    TextListItem
} from "@patternfly/react-core";

import { read_os_release } from "os-release.js";
import { useInit } from "hooks";
import { useDialogs } from "dialogs.jsx";

const _ = cockpit.gettext;

export const AboutAnacondaModal = () => {
    const Dialogs = useDialogs();
    const [isLoading, setIsLoading] = React.useState(true);
    const [kernelVersion, setKernelVersion] = React.useState(null);
    const [anacondaVersion, setAnacondaVersion] = React.useState(null);
    const [osRelease, setOsRelease] = React.useState(null);

    useInit(() => {
        const anacondaCmd = "python3 -c 'import pyanaconda.version; print(pyanaconda.version.__version__)'";
        Promise.all([
            cockpit.spawn(["uname", "-r"], [], { err: "message" })
                    .then(version => setKernelVersion(version)),
            // FIX terminal size detection..
            cockpit.spawn(["/bin/bash", "-c", anacondaCmd], [], { err: "message", pty: true })
                    .then(version => setAnacondaVersion(version)),

            read_os_release().then(osRelease => setOsRelease(osRelease))
        ]).then(setIsLoading(false));
    });

    return (
        <AboutModal
          isOpen
          onClose={() => Dialogs.close()}
          id="about-anaconda-modal"
          trademark={_("Licensed under GNU version 2.0")}
          productName={_("Anaconda")}
        >
            <div>{_("System installer for Fedora, RHEL and other distributions.")}</div>
            <div><a rel="noopener noreferrer" target="_blank" href="https://anaconda-installer.readthedocs.io/">{_("Project website")}</a></div>
            <TextContent>
                <TextList component="dl">
                    {isLoading && <span>{_("Loading data...")}</span>}
                    {osRelease !== null &&
                        <>
                            <TextListItem component="dt">{_("Product name")}</TextListItem>
                            <TextListItem component="dd">{osRelease.PRETTY_NAME}</TextListItem>
                        </>}
                    {anacondaVersion !== null &&
                        <>
                            <TextListItem component="dt">{_("Anaconda version")}</TextListItem>
                            <TextListItem component="dd">{anacondaVersion}</TextListItem>
                        </>}
                    {kernelVersion !== null &&
                        <>
                            <TextListItem component="dt">{_("Kernel version")}</TextListItem>
                            <TextListItem component="dd">{kernelVersion}</TextListItem>
                        </>}
                </TextList>
            </TextContent>
        </AboutModal>
    );
};
