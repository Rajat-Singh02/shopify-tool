import { Navigation } from "@shopify/polaris";
import { HomeIcon, PlayIcon, ProductIcon } from "@shopify/polaris-icons";
import { useLocation, useNavigate } from "react-router";

const navigationItems = [
  { label: "Dashboard", destination: "/", icon: HomeIcon },
  { label: "Videos", destination: "/videos", icon: PlayIcon, disabled: true },
  { label: "Widgets", destination: "/widgets", icon: ProductIcon, disabled: true },
];

export function AppNavigation() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Navigation location={location.pathname}>
      <Navigation.Section
        items={navigationItems.map((item) => ({
          ...item,
          onClick: item.disabled ? undefined : () => void navigate(item.destination),
        }))}
      />
    </Navigation>
  );
}
