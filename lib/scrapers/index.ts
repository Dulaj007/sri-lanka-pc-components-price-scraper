import type { Product } from "../types";
import * as barclays from "./barclays";
import * as chamacomputers from "./chamacomputers";
import * as gamestreet from "./gamestreet";
import * as mdcomputers from "./mdcomputers";
import * as nanotek from "./nanotek";
import * as pcbuilders from "./pcbuilders";
import * as techzone from "./techzone";

export interface SiteScraper {
  site: string;
  search: (query: string) => Promise<Product[]>;
}

// Every site we scrape, listed in one place. To add a new site, write a
// module that exports SITE and search(), then add it here - nothing else
// in the app needs to change.
export const scrapers: SiteScraper[] = [
  { site: pcbuilders.SITE, search: pcbuilders.search },
  { site: techzone.SITE, search: techzone.search },
  { site: gamestreet.SITE, search: gamestreet.search },
  { site: mdcomputers.SITE, search: mdcomputers.search },
  { site: nanotek.SITE, search: nanotek.search },
  { site: chamacomputers.SITE, search: chamacomputers.search },
  { site: barclays.SITE, search: barclays.search },
];
