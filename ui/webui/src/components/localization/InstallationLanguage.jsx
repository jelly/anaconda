/*
 * Copyright (C) 2022 Red Hat, Inc.
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

import React from "react";
import cockpit from "cockpit";

import {
    Flex,
    Form,
    FormGroup,
    Menu,
    MenuList,
    MenuInput,
    MenuItem,
    MenuContent,
    SearchInput,
    Divider,
} from "@patternfly/react-core";

import { EmptyStatePanel } from "cockpit-components-empty-state.jsx";
import { AddressContext } from "../Common.jsx";
import { setLocale } from "../../apis/boss.js";

import {
    getLanguage,
    getLanguages,
    getLanguageData,
    getLocales,
    getLocaleData,
    setLanguage,
    getCommonLocales,
} from "../../apis/localization.js";

import {
    convertToCockpitLang,
    getLangCookie,
    setLangCookie
} from "../../helpers/language.js";
import { AnacondaPage } from "../AnacondaPage.jsx";

import "menu-select-widget.scss";
import "./InstallationLanguage.scss";

const _ = cockpit.gettext;

const getLanguageEnglishName = lang => lang["english-name"].v;
const getLanguageId = lang => lang["language-id"].v;
const getLanguageNativeName = lang => lang["native-name"].v;
const getLocaleId = locale => locale["locale-id"].v;
const getLocaleNativeName = locale => locale["native-name"].v;

class LanguageSelector extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            languages: [],
            locales: [],
            commonLocales: [],
            search: "",
            lang: "",
        };

        this.updateNativeName = this.updateNativeName.bind(this);
        this.renderOptions = this.renderOptions.bind(this);
    }

    async componentDidMount () {
        try {
            const lang = await getLanguage();
            this.setState({ lang });
            const cockpitLang = convertToCockpitLang({ lang });
            if (getLangCookie() !== cockpitLang) {
                setLangCookie({ cockpitLang });
                window.location.reload(true);
            }
            setLocale({ locale: lang });
        } catch (e) {
            this.props.onAddErrorNotification(e);
        }

        const languageIds = await getLanguages();
        // Create the languages state object
        this.setState({ languages: await Promise.all(languageIds.map(async lang => await getLanguageData({ lang }))) });
        // Create the locales state object
        const localeIds = await Promise.all(languageIds.map(async lang => await getLocales({ lang })));
        const locales = await Promise.all(localeIds.map(async localeId => {
            return await Promise.all(localeId.map(async locale => await getLocaleData({ locale })));
        }));
        this.setState({ locales }, this.updateNativeName);

        // Create a list of common locales.
        this.setState({ commonLocales: await getCommonLocales() });
    }

    async updateNativeName (localeData) {
        localeData = localeData || await getLocaleData({ locale: this.state.lang });
        // this.props.getNativeName(getLocaleNativeName(localeData));
    }

    renderOptions (filter) {
        const { languages, locales } = this.state;
        const idPrefix = this.props.idPrefix;
        const filterLow = filter.toLowerCase();

        let filtered = [];

        // Returns a locale with a given code.
        const findLocaleWithId = (localeCode) => {
            for (const locale of this.state.locales) {
                for (const subLocale of locale) {
                    if (getLocaleId(subLocale) === localeCode) {
                        return subLocale;
                    }
                }
            }
        };
        const isSelected = locale => this.state.lang === getLocaleId(locale);

        // Returns a new instance of MenuItem from a given locale and with given prefix in it's key
        // and id.
        const createMenuItem = (locale, prefix) => {
            const item = (
                <MenuItem
                  id={idPrefix + "-" + prefix + getLocaleId(locale).split(".UTF-8")[0]}
                  key={prefix + getLocaleId(locale)}
                  isSelected={isSelected(locale)}
                  itemId={getLocaleId(locale)}
                >
                    {getLocaleNativeName(locale)}
                </MenuItem>
            );

            return item;
        };

        // List common languages.
        if (!filter) {
            filtered.push(...this.state.commonLocales.map(locale => {
                return createMenuItem(findLocaleWithId(locale), "option-common-");
            }));
        }

        // List alphabetically.
        for (const langLocales of locales) {
            const currentLang = languages.find(lang => getLanguageId(lang) === getLanguageId(langLocales[0]));

            const label = cockpit.format("$0 ($1)", getLanguageNativeName(currentLang), getLanguageEnglishName(currentLang));

            if (!filter || label.toLowerCase().indexOf(filterLow) !== -1) {
                filtered.push(...langLocales.map(locale => createMenuItem(locale, "option-alpha-")));
            }
        }

        // TODO: this is all pretty silly
        const selected = filtered.filter(f => f.props.isSelected);
        filtered = filtered.filter(f => !f.props.isSelected);
        // no results case
        if (selected.length) {
            filtered.unshift(selected[0]);
        }

        if (this.state.search && filtered.length === 0) {
            return [
                <MenuItem
                  id={idPrefix + "search-no-result"}
                  isDisabled
                  key="no-result"
                >
                    {_("No results found")}
                </MenuItem>
            ];
        }

        return filtered;
    }

    render () {
        const { languages, locales, lang, commonLocales } = this.state;
        const handleOnSelect = (_event, item) => {
            const { locales } = this.state;
            for (const locale of locales) {
                for (const localeItem of locale) {
                    if (getLocaleId(localeItem) === item) {
                        setLangCookie({ cockpitLang: convertToCockpitLang({ lang: getLocaleId(localeItem) }) });
                        setLanguage({ lang: getLocaleId(localeItem) })
                                .then(() => setLocale({ locale: getLocaleId(localeItem) }))
                                .catch(this.props.onAddErrorNotification);
                        this.setState({ lang: item });
                        this.updateNativeName(localeItem);
                        window.location.reload(true);
                        return;
                    }
                }
            }
        };

        const isLoading = languages.length === 0 || languages.length !== locales.length || commonLocales.length === 0;

        if (isLoading) {
            return <EmptyStatePanel loading />;
        }

        const options = this.renderOptions(this.state.search);

        return (
            <Flex direction={{ default: "column" }} className="language-menu-flex">
                <p>{_("The selected language will be used for both the installation and the installed software")}</p>
                <Menu
                  id={this.props.idPrefix + "-language-menu"}
                  isPlain
                  isScrollable
                  className="ct-menu-select-widget"
                  onSelect={handleOnSelect}
                  aria-invalid={!lang}
                  {...(isLoading && { loadingVariant: "spinner" })}
                >
                    <MenuInput>
                        <SearchInput
                          id={this.props.idPrefix + "-language-search"}
                          value={this.state.search}
                          onChange={(_, value) => this.setState({ search: value })}
                          onClear={() => this.setState({ search: "" })}
                        />
                    </MenuInput>
                    <Divider />
                    <MenuContent>
                        <MenuList>
                            {options}
                        </MenuList>
                    </MenuContent>
                </Menu>
            </Flex>
        );
    }
}
LanguageSelector.contextType = AddressContext;

export const InstallationLanguage = ({ idPrefix, setIsFormValid, onAddErrorNotification }) => {
    return (
        <AnacondaPage title={_("Welcome to the Anaconda installer")}>
            <Form>
                <FormGroup isRequired>
                    <LanguageSelector
                      id="language-selector"
                      idPrefix={idPrefix}
                      setIsFormValid={setIsFormValid}
                      onAddErrorNotification={onAddErrorNotification}
                    />
                </FormGroup>
            </Form>
        </AnacondaPage>
    );
};
