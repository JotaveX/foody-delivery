package dev.jotave.foody.catalog;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * The catalog only changes through migrations, which run on startup: clearing the cache then means
 * a deploy that changes products is visible right away instead of after the TTL.
 */
@Component
class CatalogCacheEvictor {

  @EventListener(ApplicationReadyEvent.class)
  @CacheEvict(cacheNames = CatalogCacheConfig.CATALOG, allEntries = true)
  public void onStartup() {
    // The eviction is done by @CacheEvict, so Redis failures go through the CacheErrorHandler.
  }
}
