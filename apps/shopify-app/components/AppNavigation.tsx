import { Navigation } from "@shopify/polaris";
import { HomeIcon, PlayIcon, ProductIcon } from "@shopify/polaris-icons";
import { useLocation, useNavigate } from "react-router";

const navigationItems = [
  { label: "Dashboard", destination: "/", icon: HomeIcon },
  { label: "Videos", destination: "/videos", icon: PlayIcon },
  { label: "Widgets", destination: "/widgets", icon: ProductIcon },
];

export function AppNavigation() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Navigation location={location.pathname}>
      <Navigation.Section
        items={navigationItems.map((item) => ({
          ...item,
          onClick: () => void navigate(item.destination),
        }))}
      />
    </Navigation>
  );
}
