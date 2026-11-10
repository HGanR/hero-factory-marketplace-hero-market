# Mobile profile picker and navigation repair

The displayed banner and circular avatar were visual containers; only the separate Change buttons opened their file inputs. Both surfaces are now native, labelled buttons that synchronously open the existing account-bound banner/avatar picker. Visible Change Banner and Edit labels make the action discoverable. Existing image validation, member revalidation after native pickers, saving, removal and account isolation are preserved.

My Workspaces now contains START MY JOURNEY and TROO TOWN. The former CRM link is removed, the wallet workspace link is removed, and START MY JOURNEY uses the same in-app World Explorer action as the main journey button. The obsolete development-status paragraph underneath those links is removed. The separate terms notice and Add to Home Screen guidance are unchanged.

Five focused jsdom tests pass: native picker controls, image-click bubbling and the correct image save field, navigation targets, cleared-session protection, and picker cancellation. Existing world tests and optimized/mobile runtime tests are run by CI and the mobile build. A real device picker and authenticated real-image persistence still require member acceptance; simulated DOM tests do not establish that result.
