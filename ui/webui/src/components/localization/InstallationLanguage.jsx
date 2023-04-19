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
    DataList,
    DataListItem,
    DataListCell,
    DataListItemRow,
    DataListItemCells,
    EmptyState,
    EmptyStateBody,
    Radio,
    Title,
    SearchInput,
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

    renderOptions (filter) {
        const { languages, locales } = this.state;
        const filterLow = filter.toLowerCase();

        const filtered = [];

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

        const handleOnSelect = item => {
            const { locales } = this.state;
            for (const locale of locales) {
                for (const localeItem of locale) {
                    if (getLocaleId(localeItem) === item) {
                        setLangCookie({ cockpitLang: convertToCockpitLang({ lang: getLocaleId(localeItem) }) });
                        setLanguage({ lang: getLocaleId(localeItem) })
                                .then(() => setLocale({ locale: getLocaleId(localeItem) }))
                                .catch(this.props.onAddErrorNotification);
                        this.setState({ lang: item });
                        window.location.reload(true);
                        return;
                    }
                }
            }
        };

        // Returns a new instance of MenuItem from a given locale and with given prefix in it's key
        // and id.
        const createMenuItem = (locale, prefix) => {
            // id={idPrefix + "-" + prefix + getLocaleId(locale).split(".UTF-8")[0]}
            // key={prefix + getLocaleId(locale)}
            // isSelected={isSelected}
            // itemId={getLocaleId(locale)}
            // style={isSelected ? { backgroundColor: "var(--pf-c-menu__list-item--hover--BackgroundColor)" } : undefined}
            // {getLocaleNativeName(locale)}
            const item = (
                <DataListItem key={prefix + getLocaleId(locale)}>
                    <DataListItemRow onClick={() => handleOnSelect(getLocaleId(locale))}>
                        <DataListItemCells
                          dataListCells={[
                              <DataListCell key="primary content">
                                  <Radio
                                    id={prefix + getLocaleId(locale)}
                                    isChecked={this.state.lang === getLocaleId(locale)}
                                    name={getLocaleId(locale)}
                                    label={getLocaleNativeName(locale)}
                                  />
                              </DataListCell>,
                          ]}
                        />
                    </DataListItemRow>
                </DataListItem>
            );

            return item;
        };

        if (!filter) {
            const selectedLocale = findLocaleWithId(this.state.lang);
            filtered.push(createMenuItem(selectedLocale, "option-selected-"));
        }

        // List common languages.
        if (!filter) {
            filtered.push(...this.state.commonLocales.filter(locale => this.state.lang !== locale).map(locale => createMenuItem(findLocaleWithId(locale), "option-common-")));
        }

        // List alphabetically.
        for (const langLocales of locales) {
            const currentLang = languages.find(lang => getLanguageId(lang) === getLanguageId(langLocales[0]));

            const label = cockpit.format("$0 ($1)", getLanguageNativeName(currentLang), getLanguageEnglishName(currentLang));

            if (!filter || label.toLowerCase().indexOf(filterLow) !== -1) {
                filtered.push(...langLocales.filter(locale => getLocaleId(locale) !== this.state.lang).map(locale => createMenuItem(locale, "option-alpha-")));
            }
        }

        return filtered;
    }

    render () {
        const { languages, locales, commonLocales } = this.state;
        const isLoading = languages.length === 0 || languages.length !== locales.length || commonLocales.length === 0;

        if (isLoading) {
            return <EmptyStatePanel loading />;
        }

        const options = this.renderOptions(this.state.search);

        return (
            <Flex direction={{ default: "column" }} className="search-form">
                <SearchInput
                  id={this.props.idPrefix + "-language-search"}
                  value={this.state.search}
                  onChange={(_, value) => this.setState({ search: value })}
                  onClear={() => this.setState({ search: "" })}
                />
                {this.state.search && options.length === 0 &&
                    <EmptyState>
                        <EmptyStateBody>
                            {_("No results found")}
                        </EmptyStateBody>
                    </EmptyState>}
                {options.length !== 0 &&
                    <DataList isCompact className="languages-list">
                        {options}
                    </DataList>}
            </Flex>
        );
    }
}
LanguageSelector.contextType = AddressContext;

export const InstallationLanguage = ({ idPrefix, setIsFormValid, onAddErrorNotification }) => {
    return (
        <AnacondaPage title={_("Welcome to the Anaconda installer")} className="language-page">
            <Title
              headingLevel="h3"
            >
                {_("Language")}
            </Title>
            <p>{_("The selected language will be used for both the installation and the installed software.")}</p>
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
