#Following URLs are connected from SSD.
#Verify if they are connecting successfully

#Run the commands inside Cluster network/pod, to check if URLs are returning 200 status OK
echo -e "== https://api.first.org"
curl -Is https://api.first.org | head -2

echo -e "\n== https://services.nvd.nist.gov"
curl -Is https://services.nvd.nist.gov | head -2

echo -e "\n== https://raw.githubusercontent.com"
curl -Is https://raw.githubusercontent.com | head -2

echo -e "\n== https://api.vulncheck.com"
curl -Is https://api.vulncheck.com | head -2
