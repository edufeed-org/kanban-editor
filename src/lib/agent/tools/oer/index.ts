/**
 * OER Tools Export
 * 
 * Zentrale Export-Datei für alle OER-bezogenen Tools.
 * 
 * @see docs/FEATURE/MCP-EDUFEED.md
 */

// API Client
export {
    searchOer,
    getOerDetails,
    listOerSources,
    checkApiHealth,
    getApiBaseUrl,
    type OerSearchParams,
    type OerSearchResult,
    type OerSource,
    type OerApiResponse
} from './oerClient.js';

// search_oer Tool
export {
    executeSearchOer,
    getLastSearchResults,
    setLastSearchResults,
    clearSearchCache,
    type SearchOerArgs
} from './oerSearchTool.js';

// add_cards_from_oer Tool
export {
    executeAddCardsFromOer,
    type AddCardsFromOerArgs
} from './oerCardsTool.js';

// list_oer_sources Tool
export {
    executeListOerSources,
    type ListOerSourcesArgs
} from './oerSourcesTool.js';

// search_oer_for_card Tool
export {
    executeSearchOerForCard,
    type SearchOerForCardArgs
} from './oerContextTool.js';