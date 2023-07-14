package main

// Package is called aw
import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net"
	"net/http"

	aw "github.com/deanishe/awgo"
)

// Workflow is the main API
var wf *aw.Workflow

func init() {
	// Create a new Workflow using default settings.
	// Critical settings are provided by Alfred via environment variables,
	// so this *will* die in flames if not run in an Alfred-like environment.
	wf = aw.New()
}

// Your workflow starts here
func run() {
	args := wf.Args()
	if len(args) == 0 {
		localIP()
	} else {
		ownershipIP(args[0])
	}
}

func localIP() {
	localIPv4, publicIPv4, localIPv6, publicIPv6, err := GetIPAddresses()
	if err != nil {
		wf.NewWarningItem("获取 IP 失败", err.Error())
		return
	}

	// Create a new item with the local IPv4 address
	item := wf.NewItem("内网 IPv4: " + localIPv4.String())

	// Add a CopyText() operation to the item
	item.Copytext(localIPv4.String())

	// Add the other IP addresses as separate items
	item = wf.NewItem("公网 IPv4: " + publicIPv4.String())
	item.Copytext(publicIPv4.String())

	item = wf.NewItem("内网 IPv6: " + localIPv6.String())
	item.Copytext(localIPv6.String())

	item = wf.NewItem("公网 IPv6: " + publicIPv6.String())
	item.Copytext(publicIPv6.String())

	// Send the feedback to Alfred
	wf.SendFeedback()
}

func ownershipIP(ip string) {
	info, err := GetIPOnwer(ip)
	if err != nil {
		wf.NewWarningItem("获取 IP 失败", err.Error())
		return
	}
	item := wf.NewItem("IP 归属")
	item.Subtitle(fmt.Sprintf("IP：%s", info.Query))
	item.Arg(info.Query)

	item = wf.NewItem(fmt.Sprintf("国家：%s", info.Country))
	item.Subtitle(fmt.Sprintf("国家代码：%s，时区：%s", info.CountryCode, info.Timezone))
	item.Arg(info.Country)
	item.Copytext(info.Country)

	item = wf.NewItem(fmt.Sprintf("省份：%s", info.RegionName))
	item.Subtitle(fmt.Sprintf("城市：%s，邮编：%s", info.City, info.Zip))
	item.Arg(info.RegionName)
	item.Copytext(info.RegionName)

	item = wf.NewItem(fmt.Sprintf("经度：%f，纬度：%f", info.Longitude, info.Latitude))
	item.Subtitle(fmt.Sprintf("ISP：%s，AS：%s", info.ISP, info.AS))
	item.Arg(fmt.Sprintf("%f,%f", info.Longitude, info.Latitude))
	item.Copytext(fmt.Sprintf("%f,%f", info.Longitude, info.Latitude))

	wf.SendFeedback()
}

func main() {
	// Wrap your entry point with Run() to catch and log panics and
	// show an error in Alfred instead of silently dying
	wf.Run(run)
}

func GetIPAddresses() (localIPv4, publicIPv4, localIPv6, publicIPv6 net.IP, err error) {
	// Get local IP addresses
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return
	}
	for _, addr := range addrs {
		ip, ok := addr.(*net.IPNet)
		if !ok {
			continue
		}
		if ip.IP.IsLoopback() {
			continue
		}
		if ip.IP.To4() != nil {
			localIPv4 = ip.IP
		} else {
			localIPv6 = ip.IP
		}
	}

	// Get public IP addresses
	resp, err := http.Get("https://api.ipify.org?format=json")
	if err != nil {
		return
	}
	defer resp.Body.Close()

	var data struct {
		IP string `json:"ip"`
	}
	if err = json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return
	}

	publicIPv4 = net.ParseIP(data.IP).To4()
	publicIPv6 = net.ParseIP(data.IP).To16()

	return
}

type IPInfo struct {
	Status      string  `json:"status"`
	Country     string  `json:"country"`
	CountryCode string  `json:"countryCode"`
	Region      string  `json:"region"`
	RegionName  string  `json:"regionName"`
	City        string  `json:"city"`
	Zip         string  `json:"zip"`
	Latitude    float64 `json:"lat"`
	Longitude   float64 `json:"lon"`
	Timezone    string  `json:"timezone"`
	ISP         string  `json:"isp"`
	Org         string  `json:"org"`
	AS          string  `json:"as"`
	Query       string  `json:"query"`
}

func GetIPOnwer(ip string) (*IPInfo, error) {
	url := fmt.Sprintf("http://ip-api.com/json/%s?lang=zh-CN", ip)

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var info IPInfo
	err = json.Unmarshal(body, &info)
	if err != nil {
		return nil, err
	}

	return &info, nil
}
