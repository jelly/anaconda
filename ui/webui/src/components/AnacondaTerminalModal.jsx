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
    Modal,
} from "@patternfly/react-core";

import { Terminal } from "cockpit-components-terminal.jsx";
import { DialogsContext } from "dialogs.jsx";

const _ = cockpit.gettext;

class AnacondaTerminalModal extends React.Component {
    static contextType = DialogsContext;

    constructor (props) {
        super(props);

        this.state = {
            channel: undefined,
        };

        this.terminalRef = React.createRef();
    }

    createChannel (user) {
        return cockpit.channel({
            payload: "stream",
            spawn: [user.shell || "/bin/bash"],
            environ: [
                "TERM=xterm-256color",
            ],
            directory: user.home || "/",
            pty: true
        });
    }

    componentDidMount () {
        cockpit.user().done(function (user) {
            this.setState({ user, channel: this.createChannel(user) });
        }.bind(this));
    }

    render () {
        const Dialogs = this.context;
        const terminal = this.state.channel
            ? <Terminal ref={this.terminalRef} channel={this.state.channel} parentId="the-terminal" />
            : <span>Loading...</span>;

        return (
            <Modal
              title={_("Debug terminal")}
              isOpen
              onClose={() => Dialogs.close()}
            >
                <div className={"terminal-body " + this.state.theme} id="the-terminal">
                    {terminal}
                </div>
            </Modal>
        );
    }
}

export default AnacondaTerminalModal;
