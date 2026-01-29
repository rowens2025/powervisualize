WITH base AS (
    SELECT
        tmp.team_member_id,
        p.category,
        p.subcategory,
        p.public
    FROM analytics.fct_team_member_personality tmp
    JOIN analytics.dim_personality p
        ON tmp.personality_id = p.personality_id
)

SELECT
    team_member_id,
    COUNT(*) AS total_personality_items,
    COUNT(*) FILTER (WHERE public = true) AS public_personality_items,
    COUNT(*) FILTER (WHERE category = 'favorites') AS favorites_count,
    COUNT(*) FILTER (WHERE category = 'values') AS values_count,
    COUNT(*) FILTER (WHERE category = 'location') AS location_count,
    COUNT(DISTINCT subcategory) AS distinct_subcategories
FROM base
GROUP BY team_member_id